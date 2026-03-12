"""
bank_ai_engine.py
Moteur IA d'analyse des transactions bancaires.
Combine règles statiques + Gemini pour classifier chaque ligne de relevé bancaire.

Pour chaque transaction, le moteur répond à 5 questions :
1. Type d'opération (paiement client, fournisseur, frais bancaires, salaire, etc.)
2. Pièce métier correspondante (facture client, facture fournisseur, charge directe, etc.)
3. Comptes comptables à utiliser (PCE tunisien)
4. Faut-il lettrer ? (oui/non + raison)
5. Niveau de confiance (fort / moyen / faible)
"""
import os
import json
import re
import logging
from typing import List, Dict, Any, Optional

logger = logging.getLogger(__name__)


# ═══════════════════════════════════════════════════════════════════════════════
# MAPPING STATIQUE ENRICHI — Règles métier tunisiennes
# (type_operation, piece_metier, account_code, account_name, lettrage, confiance)
# ═══════════════════════════════════════════════════════════════════════════════

STATIC_RULES_DEBIT = {
    # Fournisseurs
    "REGLEMENT FOUR": ("paiement_fournisseur", "facture_fournisseur", "401", "Fournisseurs d'exploitation", True, "fort"),
    "VIR FOUR": ("paiement_fournisseur", "facture_fournisseur", "401", "Fournisseurs d'exploitation", True, "fort"),
    "FOURNISSEUR": ("paiement_fournisseur", "facture_fournisseur", "401", "Fournisseurs d'exploitation", True, "fort"),
    "FOURN": ("paiement_fournisseur", "facture_fournisseur", "401", "Fournisseurs d'exploitation", True, "fort"),
    "FRNS": ("paiement_fournisseur", "facture_fournisseur", "401", "Fournisseurs d'exploitation", True, "fort"),

    # Salaires et personnel
    "VIREMENT PAIE": ("salaire", "bulletin_paie", "421", "Personnel — Rémunérations dues", False, "fort"),
    "SALAIRE": ("salaire", "bulletin_paie", "421", "Personnel — Rémunérations dues", False, "fort"),
    "PAIE": ("salaire", "bulletin_paie", "421", "Personnel — Rémunérations dues", False, "fort"),
    "PERSONNEL": ("salaire", "bulletin_paie", "421", "Personnel — Rémunérations dues", False, "fort"),
    "REMUNERATION": ("salaire", "bulletin_paie", "6311", "Salaires et appointements", False, "fort"),

    # Charges sociales
    "CNSS": ("charge_sociale", "declaration_cnss", "6341", "Cotisations sécurité sociale (CNSS)", False, "fort"),
    "CNAM": ("charge_sociale", "declaration_cnss", "6341", "Cotisations sécurité sociale (CNAM)", False, "fort"),
    "COTIS SOC": ("charge_sociale", "declaration_cnss", "634", "Charges sociales", False, "fort"),
    "COTISATION": ("charge_sociale", "declaration_cnss", "634", "Charges sociales", False, "moyen"),

    # Impôts et taxes
    "RETENUE SOURCE": ("retenue_source", "declaration_fiscale", "4353", "État — Retenues à la source", False, "fort"),
    "DECLARATION TVA": ("tva", "declaration_tva", "4351", "État — TVA à payer", False, "fort"),
    "IMPOT": ("impot", "declaration_fiscale", "691", "Impôts sur les bénéfices", False, "fort"),
    "TCL": ("taxe", "declaration_fiscale", "6358", "Taxe sur établissements (TCL)", False, "fort"),
    "TFP": ("taxe", "declaration_fiscale", "6358", "Taxe formation professionnelle (TFP)", False, "fort"),
    "FOPROLOS": ("taxe", "declaration_fiscale", "6358", "FOPROLOS", False, "fort"),
    "RS ": ("retenue_source", "declaration_fiscale", "4353", "État — Retenues à la source", False, "moyen"),
    "TVA": ("tva", "declaration_tva", "4351", "État — TVA à payer", False, "fort"),

    # Frais bancaires
    "FRAIS DE TENUE": ("frais_bancaires", "releve_bancaire", "6278", "Frais et commissions bancaires", False, "fort"),
    "FRAIS VIREMENT": ("frais_bancaires", "releve_bancaire", "6278", "Frais de virement", False, "fort"),
    "FRAIS BANCAIRE": ("frais_bancaires", "releve_bancaire", "627", "Services bancaires et assimilés", False, "fort"),
    "COMMISSION": ("frais_bancaires", "releve_bancaire", "627", "Services bancaires et assimilés", False, "fort"),
    "AGIOS": ("frais_bancaires", "releve_bancaire", "6615", "Intérêts bancaires", False, "fort"),
    "INT DEBIT": ("frais_bancaires", "releve_bancaire", "6615", "Intérêts bancaires et financement", False, "fort"),
    "DEPASSEMENT": ("frais_bancaires", "releve_bancaire", "6615", "Intérêts sur découvert", False, "fort"),
    "TENUED": ("frais_bancaires", "releve_bancaire", "6278", "Frais de tenue de compte", False, "fort"),
    "SWIFT": ("frais_bancaires", "releve_bancaire", "6278", "Frais SWIFT", False, "moyen"),

    # Loyer
    "LOYER": ("loyer", "contrat_bail", "6132", "Locations de constructions", False, "fort"),
    "LOCATION": ("loyer", "contrat_bail", "613", "Locations", False, "moyen"),
    "BAIL": ("loyer", "contrat_bail", "6132", "Locations de constructions", False, "moyen"),

    # Énergie et utilities
    "STEG": ("charge_exploitation", "facture_steg", "6061", "Fournitures non stockables (électricité)", False, "fort"),
    "ELECTRICITE": ("charge_exploitation", "facture_steg", "6061", "Fournitures non stockables (électricité)", False, "fort"),
    "SONEDE": ("charge_exploitation", "facture_sonede", "6061", "Fournitures non stockables (eau)", False, "fort"),
    "EAU": ("charge_exploitation", "facture_sonede", "6061", "Fournitures non stockables (eau)", False, "moyen"),
    "GAZ": ("charge_exploitation", "facture_gaz", "6061", "Fournitures non stockables (gaz)", False, "fort"),

    # Télécommunications
    "TUNISIE TELECOM": ("telecom", "facture_telecom", "6262", "Téléphone", False, "fort"),
    "OOREDOO": ("telecom", "facture_telecom", "6262", "Téléphone (Ooredoo)", False, "fort"),
    "ORANGE": ("telecom", "facture_telecom", "6262", "Téléphone (Orange)", False, "fort"),
    "TELEPHONE": ("telecom", "facture_telecom", "6262", "Téléphone", False, "moyen"),
    "INTERNET": ("telecom", "facture_internet", "6264", "Internet", False, "fort"),
    "TOPNET": ("telecom", "facture_internet", "6264", "Internet (TopNet)", False, "fort"),
    "GLOBALNET": ("telecom", "facture_internet", "6264", "Internet (GlobalNet)", False, "fort"),
    "HEXABYTE": ("telecom", "facture_internet", "6264", "Internet (Hexabyte)", False, "fort"),

    # Marketing & Publicité
    "META": ("marketing", "facture_publicite", "6231", "Publicité — Meta/Facebook", False, "fort"),
    "FACEBOOK": ("marketing", "facture_publicite", "6231", "Publicité — Facebook Ads", False, "fort"),
    "GOOGLE ADS": ("marketing", "facture_publicite", "6231", "Publicité — Google Ads", False, "fort"),
    "INSTAGRAM": ("marketing", "facture_publicite", "6231", "Publicité — Instagram", False, "fort"),
    "LINKEDIN": ("marketing", "facture_publicite", "6231", "Publicité — LinkedIn Ads", False, "fort"),
    "TIKTOK": ("marketing", "facture_publicite", "6231", "Publicité — TikTok Ads", False, "fort"),
    "PUBLICITE": ("marketing", "facture_publicite", "623", "Publicité, publications, relations publiques", False, "moyen"),

    # Assurances
    "AMI ASSURANCE": ("assurance", "police_assurance", "616", "Primes d'assurances (AMI)", False, "fort"),
    "ASSURANCE": ("assurance", "police_assurance", "616", "Primes d'assurances", False, "fort"),
    "STAR": ("assurance", "police_assurance", "616", "Primes d'assurances (STAR)", False, "moyen"),
    "GAT": ("assurance", "police_assurance", "616", "Primes d'assurances (GAT)", False, "moyen"),
    "COMAR": ("assurance", "police_assurance", "616", "Primes d'assurances (COMAR)", False, "moyen"),

    # Transport et automobile
    "TOTAL ENERG": ("transport", "facture_carburant", "6068", "Carburants (TotalEnergies)", False, "fort"),
    "CARBURANT": ("transport", "facture_carburant", "6068", "Carburants et lubrifiants", False, "fort"),
    "SHELL": ("transport", "facture_carburant", "6068", "Carburants (Shell)", False, "fort"),
    "AGIL": ("transport", "facture_carburant", "6068", "Carburants (Agil)", False, "fort"),
    "TAXI": ("transport", "note_frais", "6251", "Voyages et déplacements", False, "moyen"),
    "PARKING": ("transport", "note_frais", "6248", "Frais de parking", False, "moyen"),
    "PEAGE": ("transport", "note_frais", "6248", "Frais de péage", False, "moyen"),
    "REPARATION AUTO": ("entretien_vehicule", "facture_reparation", "6155", "Entretien et réparations matériel de transport", False, "fort"),
    "PIECE AUTO": ("entretien_vehicule", "facture_reparation", "6155", "Entretien et réparations matériel de transport", False, "fort"),
    "VIDANGE": ("entretien_vehicule", "facture_reparation", "6155", "Entretien et réparations matériel de transport", False, "fort"),
    "PNEU": ("entretien_vehicule", "facture_reparation", "6155", "Entretien et réparations matériel de transport", False, "fort"),
    "MECANICIEN": ("entretien_vehicule", "facture_reparation", "6155", "Entretien et réparations matériel de transport", False, "moyen"),

    # Fournitures de bureau
    "FOURNITURE": ("fourniture_bureau", "facture_fourniture", "6064", "Fournitures administratives", False, "moyen"),
    "PAPETERIE": ("fourniture_bureau", "facture_fourniture", "6064", "Fournitures administratives", False, "fort"),

    # Logiciels et abonnements
    "ABONNEMENT": ("abonnement", "facture_abonnement", "651", "Redevances pour licences et logiciels", False, "moyen"),
    "LICENCE": ("abonnement", "facture_abonnement", "651", "Redevances pour licences et logiciels", False, "moyen"),
    "SAAS": ("abonnement", "facture_abonnement", "651", "Redevances pour licences et logiciels", False, "moyen"),

    # Retrait espèces / caisse
    "RETRAIT ESP": ("retrait_especes", "operation_caisse", "531", "Caisse (retrait espèces)", False, "fort"),
    "RETRAIT GAB": ("retrait_especes", "operation_caisse", "531", "Caisse (retrait GAB)", False, "fort"),
    "RETRAIT GUICHET": ("retrait_especes", "operation_caisse", "531", "Caisse (retrait guichet)", False, "fort"),
    "RETRAIT DAB": ("retrait_especes", "operation_caisse", "531", "Caisse (retrait DAB)", False, "fort"),
    "DOTATION CAISSE": ("retrait_especes", "operation_caisse", "531", "Caisse", False, "fort"),

    # Achats par carte
    "PAIEMENT CARTE": ("achat_carte", "ticket_caisse", "531", "Caisse / Achats par carte", False, "moyen"),
    "PAI CARTE": ("achat_carte", "ticket_caisse", "531", "Caisse / Achats par carte", False, "moyen"),
    "TPE": ("achat_carte", "ticket_caisse", "531", "Terminal de paiement", False, "moyen"),

    # Honoraires et services
    "EXPERT COMPTABLE": ("honoraire", "facture_honoraire", "6224", "Honoraires (Expert-comptable)", False, "fort"),
    "HONORAIRE": ("honoraire", "facture_honoraire", "6224", "Honoraires", False, "fort"),
    "AVOCAT": ("honoraire", "facture_honoraire", "6224", "Honoraires (Avocat)", False, "fort"),
    "CONSEIL": ("honoraire", "facture_conseil", "6224", "Honoraires de conseil", False, "moyen"),
    "CONSULTANT": ("honoraire", "facture_conseil", "6224", "Honoraires de consultant", False, "moyen"),

    # Virement interne
    "VIR PROPRE COMPTE": ("virement_interne", "ordre_virement", "580", "Virements internes", False, "fort"),
    "VIREMENT INTERNE": ("virement_interne", "ordre_virement", "580", "Virements internes", False, "fort"),
    "TRANSFERT COMPTE": ("virement_interne", "ordre_virement", "580", "Virements internes", False, "fort"),
}

STATIC_RULES_CREDIT = {
    # Paiements clients
    "RECOUVREMENT": ("paiement_client", "facture_client", "411", "Clients", True, "fort"),
    "REG CLIENT": ("paiement_client", "facture_client", "411", "Clients", True, "fort"),
    "REMISE CHEQUE": ("paiement_client", "facture_client", "411", "Clients — Remise chèque", True, "fort"),
    "REMISE CHQ": ("paiement_client", "facture_client", "411", "Clients — Remise chèque", True, "fort"),
    "ENCAISSEMENT": ("paiement_client", "facture_client", "411", "Clients", True, "moyen"),
    "CLIENT": ("paiement_client", "facture_client", "411", "Clients", True, "fort"),
    "VENTE": ("paiement_client", "facture_client", "411", "Clients", True, "moyen"),

    # Versement espèces
    "VERSEMENT ESP": ("versement_especes", "operation_caisse", "531", "Caisse (versement espèces)", False, "fort"),
    "ALIMENTATION": ("versement_especes", "operation_caisse", "531", "Caisse (alimentation)", False, "moyen"),

    # Remboursements
    "REMBOURSEMENT": ("remboursement", "avoir", "401", "Fournisseurs (remboursement)", False, "moyen"),
    "EXTOURNE": ("remboursement", "avoir", "401", "Fournisseurs (extourne)", False, "moyen"),
    "AVOIR": ("remboursement", "avoir", "401", "Fournisseurs (avoir)", False, "moyen"),

    # Produits financiers
    "INT CREDIT": ("produit_financier", "releve_bancaire", "756", "Produits financiers — Intérêts créditeurs", False, "fort"),
    "INTERET": ("produit_financier", "releve_bancaire", "756", "Produits financiers — Intérêts", False, "fort"),

    # TVA récupérée
    "REMBT TVA": ("remboursement_tva", "declaration_tva", "4367", "Crédit de TVA à reporter", False, "fort"),
    "CREDIT TVA": ("remboursement_tva", "declaration_tva", "4367", "Crédit de TVA à reporter", False, "fort"),

    # Virement interne (reçu)
    "VIR RECU": ("virement_interne", "ordre_virement", "580", "Virements internes", False, "fort"),
    "VIR PROPRE": ("virement_interne", "ordre_virement", "580", "Virements internes", False, "fort"),
}


def _match_static_rules(description: str, is_credit: bool) -> Optional[Dict[str, Any]]:
    """Cherche une correspondance dans les règles statiques (priorité aux patterns longs)."""
    desc_upper = description.upper().strip()
    rules = STATIC_RULES_CREDIT if is_credit else STATIC_RULES_DEBIT
    sorted_keys = sorted(rules.keys(), key=len, reverse=True)

    for keyword in sorted_keys:
        if keyword in desc_upper:
            (op_type, piece_metier, account_code, account_name, lettrage, confiance) = rules[keyword]
            return {
                "operation_type": op_type,
                "piece_metier": piece_metier,
                "account_code": account_code,
                "account_name": account_name,
                "needs_lettrage": lettrage,
                "lettrage_reason": "Facture/paiement identifié" if lettrage else "Charge directe — pas de lettrage",
                "confidence": confiance,
                "source": "static_rules",
                "matched_keyword": keyword,
            }
    return None


# ═══════════════════════════════════════════════════════════════════════════════
# PROMPT GEMINI — Analyse IA contextuelle
# ═══════════════════════════════════════════════════════════════════════════════

GEMINI_ANALYSIS_PROMPT = """Tu es un EXPERT-COMPTABLE TUNISIEN spécialisé en comptabilité des entreprises (PCE/SCE tunisien).

Analyse ces transactions bancaires et pour CHAQUE transaction, réponds aux 5 questions suivantes au format JSON strict.

TRANSACTIONS À ANALYSER :
{transactions_json}

PLAN COMPTABLE DE RÉFÉRENCE (comptes principaux) :
- 401 Fournisseurs d'exploitation
- 411 Clients
- 421 Personnel — Rémunérations dues
- 431 Sécurité sociale (CNSS)
- 4351 État — TVA à payer
- 4353 État — Retenues à la source
- 4362 TVA récupérable sur achats et charges
- 4367 Crédit de TVA à reporter
- 521 Banques
- 531 Caisse
- 580 Virements internes
- 601 Achats de matières premières
- 604 Achats de prestations de services
- 606 Achats non stockés de matières et fournitures
- 6061 Fournitures non stockables (eau, électricité)
- 6064 Fournitures administratives
- 6068 Autres matières et fournitures (carburants, etc.)
- 607 Achats de marchandises
- 611 Sous-traitance générale
- 6132 Locations de constructions (loyer)
- 6155 Entretien matériel de transport
- 616 Primes d'assurances
- 6224 Honoraires
- 6231 Publicité, annonces et insertions
- 6248 Divers transports
- 6251 Voyages et déplacements
- 6262 Téléphone
- 6264 Internet
- 627 Services bancaires et assimilés
- 6278 Autres frais et commissions bancaires
- 6311 Salaires et appointements
- 6341 Cotisations sécurité sociale
- 6358 Autres impôts et taxes (TCL, TFP, FOPROLOS)
- 6615 Intérêts bancaires
- 651 Redevances pour licences et logiciels
- 691 Impôts sur les bénéfices
- 706 Prestations de services
- 707 Ventes de marchandises
- 756 Produits financiers

RÈGLES MÉTIER TUNISIENNES :
1. Un DÉBIT sur le relevé = sortie d'argent → Écriture : Débit CHARGE/Crédit 521 Banques
2. Un CRÉDIT sur le relevé = entrée d'argent → Écriture : Débit 521 Banques/Crédit PRODUIT ou 411
3. Si c'est un paiement fournisseur identifiable → 401 + lettrage OUI
4. Si c'est un encaissement client → 411 + lettrage OUI
5. Les frais bancaires → 627/6278/6615 + lettrage NON
6. Les salaires → 421 + lettrage NON
7. CNSS/CNAM → 6341 + lettrage NON
8. Meta/Facebook/Google Ads → 6231 (Publicité)
9. Pièces auto, vidange → 6155
10. Carburant (Shell, Total, Agil) → 6068
11. STEG/électricité → 6061
12. Télécom (Ooredoo, TT, Orange) → 6262
13. Internet (TopNet, etc.) → 6264
14. Assurance → 616

Réponds UNIQUEMENT avec un JSON valide (pas de markdown) au format :
{{
  "analyses": [
    {{
      "index": 0,
      "operation_type": "paiement_fournisseur|paiement_client|frais_bancaires|salaire|charge_sociale|impot|tva|loyer|telecom|marketing|assurance|transport|retrait_especes|virement_interne|remboursement|charge_exploitation|produit_financier|honoraire|abonnement|fourniture_bureau|retenue_source|taxe|achat_carte|entretien_vehicule|versement_especes|remboursement_tva|autre",
      "piece_metier": "facture_fournisseur|facture_client|bulletin_paie|declaration_cnss|declaration_tva|declaration_fiscale|releve_bancaire|contrat_bail|facture_telecom|facture_publicite|police_assurance|facture_carburant|operation_caisse|ordre_virement|avoir|note_frais|ecriture_manuelle|facture_steg|facture_sonede|facture_internet|facture_honoraire|facture_conseil|facture_abonnement|facture_fourniture|facture_reparation|ticket_caisse|facture_gaz",
      "account_code": "401",
      "account_name": "Fournisseurs d'exploitation",
      "needs_lettrage": true,
      "lettrage_reason": "Paiement identifié comme règlement de facture fournisseur",
      "confidence": "fort|moyen|faible",
      "explanation": "Courte explication de la classification (1 ligne)"
    }}
  ]
}}

IMPORTANT :
- L'index correspond à l'ordre des transactions envoyées (commence à 0)
- "needs_lettrage" = true si c'est un paiement de facture (client OU fournisseur)
- "needs_lettrage" = false si c'est une charge directe
- Sois PRÉCIS sur les codes comptables (sous-comptes quand possible)
- Pour "confidence": "fort" si le libellé est clair, "moyen" si probable, "faible" si ambigu
"""


def _sync_analyze_batch(batch_transactions: List[Dict], start_index: int, api_key: str) -> Optional[List[Dict]]:
    """Analyse un batch de transactions avec Gemini. Synchrone."""
    try:
        from google import genai
        from google.genai import types as gt

        client = genai.Client(api_key=api_key)
        tx_for_prompt = []
        for i, tx in enumerate(batch_transactions):
            tx_for_prompt.append({
                "index": start_index + i,
                "date": tx.get("date", ""),
                "description": tx.get("description", ""),
                "debit": float(tx.get("debit", 0)),
                "credit": float(tx.get("credit", 0)),
                "type": tx.get("type", tx.get("transaction_type", "autre")),
            })

        prompt = GEMINI_ANALYSIS_PROMPT.format(
            transactions_json=json.dumps(tx_for_prompt, ensure_ascii=False, indent=2)
        )

        models = ["gemini-2.5-flash", "gemini-2.0-flash"]
        for model_name in models:
            try:
                response = client.models.generate_content(
                    model=model_name,
                    contents=[prompt],
                    config=gt.GenerateContentConfig(
                        automatic_function_calling=gt.AutomaticFunctionCallingConfig(disable=True),
                        max_output_tokens=65536,
                    )
                )
                raw = (response.text or "").strip()
                if raw.startswith("```"):
                    raw = re.sub(r"^```(?:json)?\n?", "", raw)
                    raw = re.sub(r"\n?```$", "", raw.strip())
                if not raw:
                    continue
                try:
                    data = json.loads(raw)
                except json.JSONDecodeError:
                    data = _repair_analysis_json(raw)
                    if not data:
                        logger.warning("Gemini %s: JSON malformed for batch at index %d", model_name, start_index)
                        continue
                analyses = data.get("analyses", [])
                logger.info("Gemini %s: %d analyses retournées (batch start=%d)", model_name, len(analyses), start_index)
                return analyses
            except Exception as e:
                err = str(e)
                if "429" in err or "RESOURCE_EXHAUSTED" in err or "404" in err or "NOT_FOUND" in err:
                    continue
                logger.warning("Gemini %s erreur: %s", model_name, e)
                break
        return None
    except Exception as e:
        logger.warning("Gemini analysis échec (batch start=%d): %s", start_index, e)
        return None


def _repair_analysis_json(raw: str) -> Optional[Dict]:
    """Attempt to repair malformed analysis JSON from Gemini."""
    for suffix in ["", "}", "]}", "]}}"]:
        try:
            return json.loads(raw + suffix)
        except json.JSONDecodeError:
            pass
    match = re.search(r'"analyses"\s*:\s*\[', raw)
    if match:
        bracket_pos = raw.index('[', match.start())
        last_brace = raw.rfind('}')
        if last_brace > bracket_pos:
            trimmed = raw[:last_brace + 1] + "]}"
            try:
                return json.loads(trimmed)
            except json.JSONDecodeError:
                pass
    return None


async def analyze_transactions_with_gemini(
    transactions: List[Dict],
    api_key: str
) -> Optional[List[Dict]]:
    """Analyse les transactions par batches de 50 pour éviter les timeouts et troncatures."""
    import asyncio

    BATCH_SIZE = 50
    all_analyses = []

    for batch_start in range(0, len(transactions), BATCH_SIZE):
        batch = transactions[batch_start:batch_start + BATCH_SIZE]
        logger.info("AI analysis batch %d-%d / %d", batch_start, batch_start + len(batch), len(transactions))
        try:
            batch_result = await asyncio.wait_for(
                asyncio.to_thread(_sync_analyze_batch, batch, batch_start, api_key),
                timeout=180.0,
            )
            if batch_result:
                all_analyses.extend(batch_result)
        except asyncio.TimeoutError:
            logger.warning("AI analysis batch %d-%d timeout (180s)", batch_start, batch_start + len(batch))
        except Exception as e:
            logger.warning("AI analysis batch %d-%d erreur: %s", batch_start, batch_start + len(batch), e)

    return all_analyses if all_analyses else None


# ═══════════════════════════════════════════════════════════════════════════════
# MOTEUR PRINCIPAL — Combine static + IA
# ═══════════════════════════════════════════════════════════════════════════════

async def analyze_bank_transactions(
    transactions: List[Dict],
    use_ai: bool = True
) -> List[Dict]:
    """
    Analyse complète de chaque transaction bancaire.
    1. Règles statiques (rapide, fiable) pour les cas à confiance forte
    2. Gemini pour les non-résolus ou à confiance faible
    3. Fusion des résultats
    """
    results = []
    unresolved_indices = []

    for i, tx in enumerate(transactions):
        desc = tx.get("description", "")
        debit = float(tx.get("debit", 0))
        credit = float(tx.get("credit", 0))
        is_credit = credit > 0

        static_match = _match_static_rules(desc, is_credit)

        if static_match and static_match["confidence"] == "fort":
            if is_credit:
                ad, adn = "521", "Banques"
                ac, acn = static_match["account_code"], static_match["account_name"]
            else:
                ad, adn = static_match["account_code"], static_match["account_name"]
                ac, acn = "521", "Banques"
            results.append({
                "index": i,
                "operation_type": static_match["operation_type"],
                "piece_metier": static_match["piece_metier"],
                "account_debit": ad, "account_debit_name": adn,
                "account_credit": ac, "account_credit_name": acn,
                "needs_lettrage": static_match["needs_lettrage"],
                "lettrage_reason": static_match["lettrage_reason"],
                "confidence": "fort",
                "explanation": f"Règle statique: {static_match['matched_keyword']}",
                "source": "static_rules",
            })
        else:
            unresolved_indices.append(i)
            if static_match:
                if is_credit:
                    ad, adn = "521", "Banques"
                    ac, acn = static_match["account_code"], static_match["account_name"]
                else:
                    ad, adn = static_match["account_code"], static_match["account_name"]
                    ac, acn = "521", "Banques"
                results.append({
                    "index": i,
                    "operation_type": static_match["operation_type"],
                    "piece_metier": static_match["piece_metier"],
                    "account_debit": ad, "account_debit_name": adn,
                    "account_credit": ac, "account_credit_name": acn,
                    "needs_lettrage": static_match["needs_lettrage"],
                    "lettrage_reason": static_match["lettrage_reason"],
                    "confidence": static_match["confidence"],
                    "explanation": f"Règle statique partielle: {static_match['matched_keyword']}",
                    "source": "static_rules_partial",
                })
            else:
                if is_credit:
                    results.append({
                        "index": i, "operation_type": "autre", "piece_metier": "ecriture_manuelle",
                        "account_debit": "521", "account_debit_name": "Banques",
                        "account_credit": "411", "account_credit_name": "Clients / Recette à identifier",
                        "needs_lettrage": False, "lettrage_reason": "Transaction non identifiée",
                        "confidence": "faible", "explanation": "Aucune correspondance trouvée", "source": "default",
                    })
                else:
                    results.append({
                        "index": i, "operation_type": "autre", "piece_metier": "ecriture_manuelle",
                        "account_debit": "401", "account_debit_name": "Fournisseurs / Charge à identifier",
                        "account_credit": "521", "account_credit_name": "Banques",
                        "needs_lettrage": False, "lettrage_reason": "Transaction non identifiée",
                        "confidence": "faible", "explanation": "Aucune correspondance trouvée", "source": "default",
                    })

    gemini_key = os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_AI_KEY")
    if use_ai and gemini_key and unresolved_indices:
        ai_analyses = await analyze_transactions_with_gemini(transactions, gemini_key)
        if ai_analyses:
            ai_by_index = {a["index"]: a for a in ai_analyses if "index" in a}
            for idx in unresolved_indices:
                if idx in ai_by_index:
                    ai = ai_by_index[idx]
                    is_credit = float(transactions[idx].get("credit", 0)) > 0
                    if is_credit:
                        ad, adn = "521", "Banques"
                        ac = ai.get("account_code", "411")
                        acn = ai.get("account_name", "Clients")
                    else:
                        ad = ai.get("account_code", "401")
                        adn = ai.get("account_name", "Fournisseurs")
                        ac, acn = "521", "Banques"
                    results[idx] = {
                        "index": idx,
                        "operation_type": ai.get("operation_type", "autre"),
                        "piece_metier": ai.get("piece_metier", "ecriture_manuelle"),
                        "account_debit": ad, "account_debit_name": adn,
                        "account_credit": ac, "account_credit_name": acn,
                        "needs_lettrage": ai.get("needs_lettrage", False),
                        "lettrage_reason": ai.get("lettrage_reason", ""),
                        "confidence": ai.get("confidence", "moyen"),
                        "explanation": ai.get("explanation", "Analyse IA"),
                        "source": "gemini_ai",
                    }

    results.sort(key=lambda x: x["index"])
    return results
