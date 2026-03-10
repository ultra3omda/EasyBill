# 🎯 PROMPT CURSOR — Agent Claude Opus
# Moteur IA d'analyse bancaire + écritures comptables intelligentes

## CONTEXTE DU PROJET

Tu travailles sur **EasyBill**, une application de facturation/comptabilité tunisienne (FastAPI + React + MongoDB). Le module **Lettrage bancaire** permet d'uploader des relevés bancaires (PDF/image), d'extraire les transactions, et de proposer des écritures comptables.

### Problème actuel
- L'extraction par **pdfplumber** (OCR basique) ne donne pas de résultats fiables pour les relevés scannés
- La classification des comptes comptables est basée sur des **mots-clés simples** (`_suggest_accounts()`) — insuffisant
- Le système ne répond PAS aux 5 questions métier essentielles pour chaque transaction

### Objectif
Remplacer le moteur de classification basique par un **moteur IA intelligent** qui utilise **Gemini** pour :
1. Extraire fiablement les données des relevés bancaires (PDF + images)
2. Pour chaque ligne bancaire, répondre aux 5 questions comptables
3. Proposer des écritures comptables précises avec classification intelligente

---

## ARCHITECTURE DES FICHIERS À MODIFIER

```
backend/
├── services/
│   └── bank_ai_engine.py          ← NOUVEAU : Moteur IA d'analyse bancaire
├── routes/
│   └── bank_reconciliation.py     ← MODIFIER : Intégrer le moteur IA
├── data/
│   └── tunisian_chart_of_accounts.py  ← EXISTANT (490 comptes PCE tunisien)
frontend/
└── src/pages/
    └── BankReconciliation.js      ← MODIFIER : Afficher les résultats IA enrichis
```

---

## ÉTAPE 1 — Créer le service `backend/services/bank_ai_engine.py`

### Description
Ce service est le cœur du moteur IA. Il combine :
- Un **mapping statique enrichi** (règles métier tunisiennes connues)
- Un **appel Gemini** pour l'analyse contextuelle intelligente

### Spécification complète

```python
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
# ═══════════════════════════════════════════════════════════════════════════════

# Mots-clés → (type_operation, piece_metier, compte_debit, nom_debit, compte_credit, nom_credit, lettrage, confiance)
# Pour les DÉBITS (sorties d'argent) : le compte_debit est la charge/fournisseur, le crédit est 521 Banques
# Pour les CRÉDITS (entrées d'argent) : le débit est 521 Banques, le compte_credit est le produit/client

STATIC_RULES_DEBIT = {
    # ── Fournisseurs ──
    "FOURNISSEUR": ("paiement_fournisseur", "facture_fournisseur", "401", "Fournisseurs d'exploitation", True, "fort"),
    "FOURN": ("paiement_fournisseur", "facture_fournisseur", "401", "Fournisseurs d'exploitation", True, "fort"),
    "FRNS": ("paiement_fournisseur", "facture_fournisseur", "401", "Fournisseurs d'exploitation", True, "fort"),
    "VIR FOUR": ("paiement_fournisseur", "facture_fournisseur", "401", "Fournisseurs d'exploitation", True, "fort"),
    "REGLEMENT FOUR": ("paiement_fournisseur", "facture_fournisseur", "401", "Fournisseurs d'exploitation", True, "fort"),

    # ── Salaires et personnel ──
    "SALAIRE": ("salaire", "bulletin_paie", "421", "Personnel — Rémunérations dues", False, "fort"),
    "PAIE": ("salaire", "bulletin_paie", "421", "Personnel — Rémunérations dues", False, "fort"),
    "VIREMENT PAIE": ("salaire", "bulletin_paie", "421", "Personnel — Rémunérations dues", False, "fort"),
    "PERSONNEL": ("salaire", "bulletin_paie", "421", "Personnel — Rémunérations dues", False, "fort"),
    "REMUNERATION": ("salaire", "bulletin_paie", "6311", "Salaires et appointements", False, "fort"),

    # ── Charges sociales ──
    "CNSS": ("charge_sociale", "declaration_cnss", "6341", "Cotisations sécurité sociale (CNSS)", False, "fort"),
    "CNAM": ("charge_sociale", "declaration_cnss", "6341", "Cotisations sécurité sociale (CNAM)", False, "fort"),
    "COTIS SOC": ("charge_sociale", "declaration_cnss", "634", "Charges sociales", False, "fort"),
    "COTISATION": ("charge_sociale", "declaration_cnss", "634", "Charges sociales", False, "moyen"),

    # ── Impôts et taxes ──
    "IMPOT": ("impot", "declaration_fiscale", "691", "Impôts sur les bénéfices", False, "fort"),
    "TCL": ("taxe", "declaration_fiscale", "6358", "Taxe sur établissements (TCL)", False, "fort"),
    "TFP": ("taxe", "declaration_fiscale", "6358", "Taxe formation professionnelle (TFP)", False, "fort"),
    "FOPROLOS": ("taxe", "declaration_fiscale", "6358", "FOPROLOS", False, "fort"),
    "RETENUE SOURCE": ("retenue_source", "declaration_fiscale", "4353", "État — Retenues à la source", False, "fort"),
    "RS ": ("retenue_source", "declaration_fiscale", "4353", "État — Retenues à la source", False, "moyen"),
    "TVA": ("tva", "declaration_tva", "4351", "État — TVA à payer", False, "fort"),
    "DECLARATION TVA": ("tva", "declaration_tva", "4351", "État — TVA à payer", False, "fort"),

    # ── Frais bancaires ──
    "COMMISSION": ("frais_bancaires", "releve_bancaire", "627", "Services bancaires et assimilés", False, "fort"),
    "FRAIS BANCAIRE": ("frais_bancaires", "releve_bancaire", "627", "Services bancaires et assimilés", False, "fort"),
    "FRAIS DE TENUE": ("frais_bancaires", "releve_bancaire", "6278", "Frais et commissions bancaires", False, "fort"),
    "AGIOS": ("frais_bancaires", "releve_bancaire", "6615", "Intérêts bancaires", False, "fort"),
    "INT DEBIT": ("frais_bancaires", "releve_bancaire", "6615", "Intérêts bancaires et financement", False, "fort"),
    "DEPASSEMENT": ("frais_bancaires", "releve_bancaire", "6615", "Intérêts sur découvert", False, "fort"),
    "TENUED": ("frais_bancaires", "releve_bancaire", "6278", "Frais de tenue de compte", False, "fort"),
    "FRAIS VIREMENT": ("frais_bancaires", "releve_bancaire", "6278", "Frais de virement", False, "fort"),
    "SWIFT": ("frais_bancaires", "releve_bancaire", "6278", "Frais SWIFT", False, "moyen"),

    # ── Loyer ──
    "LOYER": ("loyer", "contrat_bail", "6132", "Locations de constructions", False, "fort"),
    "LOCATION": ("loyer", "contrat_bail", "613", "Locations", False, "moyen"),
    "BAIL": ("loyer", "contrat_bail", "6132", "Locations de constructions", False, "moyen"),

    # ── Énergie et utilities ──
    "STEG": ("charge_exploitation", "facture_steg", "6061", "Fournitures non stockables (électricité)", False, "fort"),
    "ELECTRICITE": ("charge_exploitation", "facture_steg", "6061", "Fournitures non stockables (électricité)", False, "fort"),
    "SONEDE": ("charge_exploitation", "facture_sonede", "6061", "Fournitures non stockables (eau)", False, "fort"),
    "EAU": ("charge_exploitation", "facture_sonede", "6061", "Fournitures non stockables (eau)", False, "moyen"),
    "GAZ": ("charge_exploitation", "facture_gaz", "6061", "Fournitures non stockables (gaz)", False, "fort"),

    # ── Télécommunications ──
    "TUNISIE TELECOM": ("telecom", "facture_telecom", "6262", "Téléphone", False, "fort"),
    "OOREDOO": ("telecom", "facture_telecom", "6262", "Téléphone (Ooredoo)", False, "fort"),
    "ORANGE": ("telecom", "facture_telecom", "6262", "Téléphone (Orange)", False, "fort"),
    "TELEPHONE": ("telecom", "facture_telecom", "6262", "Téléphone", False, "moyen"),
    "INTERNET": ("telecom", "facture_internet", "6264", "Internet", False, "fort"),
    "TOPNET": ("telecom", "facture_internet", "6264", "Internet (TopNet)", False, "fort"),
    "GLOBALNET": ("telecom", "facture_internet", "6264", "Internet (GlobalNet)", False, "fort"),
    "HEXABYTE": ("telecom", "facture_internet", "6264", "Internet (Hexabyte)", False, "fort"),

    # ── Marketing & Publicité ──
    "META": ("marketing", "facture_publicite", "6231", "Publicité — Annonces et insertions (Meta/Facebook)", False, "fort"),
    "FACEBOOK": ("marketing", "facture_publicite", "6231", "Publicité — Facebook Ads", False, "fort"),
    "GOOGLE ADS": ("marketing", "facture_publicite", "6231", "Publicité — Google Ads", False, "fort"),
    "INSTAGRAM": ("marketing", "facture_publicite", "6231", "Publicité — Instagram", False, "fort"),
    "LINKEDIN": ("marketing", "facture_publicite", "6231", "Publicité — LinkedIn Ads", False, "fort"),
    "TIKTOK": ("marketing", "facture_publicite", "6231", "Publicité — TikTok Ads", False, "fort"),
    "PUBLICITE": ("marketing", "facture_publicite", "623", "Publicité, publications, relations publiques", False, "moyen"),

    # ── Assurances ──
    "ASSURANCE": ("assurance", "police_assurance", "616", "Primes d'assurances", False, "fort"),
    "STAR": ("assurance", "police_assurance", "616", "Primes d'assurances (STAR)", False, "moyen"),
    "GAT": ("assurance", "police_assurance", "616", "Primes d'assurances (GAT)", False, "moyen"),
    "COMAR": ("assurance", "police_assurance", "616", "Primes d'assurances (COMAR)", False, "moyen"),
    "CARTE": ("assurance", "police_assurance", "6162", "Assurance matériel de transport", False, "moyen"),
    "AMI ASSURANCE": ("assurance", "police_assurance", "616", "Primes d'assurances (AMI)", False, "fort"),

    # ── Transport et automobile ──
    "CARBURANT": ("transport", "facture_carburant", "6068", "Carburants et lubrifiants", False, "fort"),
    "SHELL": ("transport", "facture_carburant", "6068", "Carburants (Shell)", False, "fort"),
    "TOTAL ENERG": ("transport", "facture_carburant", "6068", "Carburants (TotalEnergies)", False, "fort"),
    "AGIL": ("transport", "facture_carburant", "6068", "Carburants (Agil)", False, "fort"),
    "TAXI": ("transport", "note_frais", "6251", "Voyages et déplacements", False, "moyen"),
    "PARKING": ("transport", "note_frais", "6248", "Frais de parking", False, "moyen"),
    "PEAGE": ("transport", "note_frais", "6248", "Frais de péage", False, "moyen"),
    "PIECE AUTO": ("entretien_vehicule", "facture_reparation", "6155", "Entretien et réparations matériel de transport", False, "fort"),
    "REPARATION AUTO": ("entretien_vehicule", "facture_reparation", "6155", "Entretien et réparations matériel de transport", False, "fort"),
    "VIDANGE": ("entretien_vehicule", "facture_reparation", "6155", "Entretien et réparations matériel de transport", False, "fort"),
    "PNEU": ("entretien_vehicule", "facture_reparation", "6155", "Entretien et réparations matériel de transport", False, "fort"),
    "MECANICIEN": ("entretien_vehicule", "facture_reparation", "6155", "Entretien et réparations matériel de transport", False, "moyen"),

    # ── Fournitures de bureau ──
    "FOURNITURE": ("fourniture_bureau", "facture_fourniture", "6064", "Fournitures administratives", False, "moyen"),
    "PAPETERIE": ("fourniture_bureau", "facture_fourniture", "6064", "Fournitures administratives", False, "fort"),
    "BUREAU VERITAS": ("fourniture_bureau", "facture_fourniture", "6064", "Fournitures administratives", False, "moyen"),

    # ── Logiciels et abonnements ──
    "ABONNEMENT": ("abonnement", "facture_abonnement", "651", "Redevances pour licences et logiciels", False, "moyen"),
    "LICENCE": ("abonnement", "facture_abonnement", "651", "Redevances pour licences et logiciels", False, "moyen"),
    "SAAS": ("abonnement", "facture_abonnement", "651", "Redevances pour licences et logiciels", False, "moyen"),

    # ── Retrait espèces / caisse ──
    "RETRAIT ESP": ("retrait_especes", "operation_caisse", "531", "Caisse (retrait espèces)", False, "fort"),
    "RETRAIT GAB": ("retrait_especes", "operation_caisse", "531", "Caisse (retrait GAB)", False, "fort"),
    "RETRAIT GUICHET": ("retrait_especes", "operation_caisse", "531", "Caisse (retrait guichet)", False, "fort"),
    "RETRAIT DAB": ("retrait_especes", "operation_caisse", "531", "Caisse (retrait DAB)", False, "fort"),
    "DOTATION CAISSE": ("retrait_especes", "operation_caisse", "531", "Caisse", False, "fort"),

    # ── Achats par carte ──
    "PAIEMENT CARTE": ("achat_carte", "ticket_caisse", "531", "Caisse / Achats par carte", False, "moyen"),
    "PAI CARTE": ("achat_carte", "ticket_caisse", "531", "Caisse / Achats par carte", False, "moyen"),
    "TPE": ("achat_carte", "ticket_caisse", "531", "Terminal de paiement", False, "moyen"),

    # ── Honoraires et services ──
    "HONORAIRE": ("honoraire", "facture_honoraire", "6224", "Honoraires", False, "fort"),
    "AVOCAT": ("honoraire", "facture_honoraire", "6224", "Honoraires (Avocat)", False, "fort"),
    "EXPERT COMPTABLE": ("honoraire", "facture_honoraire", "6224", "Honoraires (Expert-comptable)", False, "fort"),
    "CONSEIL": ("honoraire", "facture_conseil", "6224", "Honoraires de conseil", False, "moyen"),
    "CONSULTANT": ("honoraire", "facture_conseil", "6224", "Honoraires de consultant", False, "moyen"),

    # ── Virement interne ──
    "VIR PROPRE COMPTE": ("virement_interne", "ordre_virement", "580", "Virements internes", False, "fort"),
    "VIREMENT INTERNE": ("virement_interne", "ordre_virement", "580", "Virements internes", False, "fort"),
    "TRANSFERT COMPTE": ("virement_interne", "ordre_virement", "580", "Virements internes", False, "fort"),
}

STATIC_RULES_CREDIT = {
    # ── Paiements clients ──
    "CLIENT": ("paiement_client", "facture_client", "411", "Clients", True, "fort"),
    "VENTE": ("paiement_client", "facture_client", "411", "Clients", True, "moyen"),
    "RECOUVREMENT": ("paiement_client", "facture_client", "411", "Clients", True, "fort"),
    "REG CLIENT": ("paiement_client", "facture_client", "411", "Clients", True, "fort"),
    "ENCAISSEMENT": ("paiement_client", "facture_client", "411", "Clients", True, "moyen"),
    "REMISE CHEQUE": ("paiement_client", "facture_client", "411", "Clients — Remise chèque", True, "fort"),
    "REMISE CHQ": ("paiement_client", "facture_client", "411", "Clients — Remise chèque", True, "fort"),

    # ── Versement espèces ──
    "VERSEMENT ESP": ("versement_especes", "operation_caisse", "531", "Caisse (versement espèces)", False, "fort"),
    "ALIMENTATION": ("versement_especes", "operation_caisse", "531", "Caisse (alimentation)", False, "moyen"),

    # ── Remboursements ──
    "REMBOURSEMENT": ("remboursement", "avoir", "401", "Fournisseurs (remboursement)", False, "moyen"),
    "EXTOURNE": ("remboursement", "avoir", "401", "Fournisseurs (extourne)", False, "moyen"),
    "AVOIR": ("remboursement", "avoir", "401", "Fournisseurs (avoir)", False, "moyen"),

    # ── Produits financiers ──
    "INTERET": ("produit_financier", "releve_bancaire", "756", "Produits financiers — Intérêts", False, "fort"),
    "INT CREDIT": ("produit_financier", "releve_bancaire", "756", "Produits financiers — Intérêts créditeurs", False, "fort"),

    # ── TVA récupérée ──
    "REMBT TVA": ("remboursement_tva", "declaration_tva", "4367", "Crédit de TVA à reporter", False, "fort"),
    "CREDIT TVA": ("remboursement_tva", "declaration_tva", "4367", "Crédit de TVA à reporter", False, "fort"),

    # ── Virement interne (reçu) ──
    "VIR RECU": ("virement_interne", "ordre_virement", "580", "Virements internes", False, "fort"),
    "VIR PROPRE": ("virement_interne", "ordre_virement", "580", "Virements internes", False, "fort"),
}


def _match_static_rules(description: str, is_credit: bool) -> Optional[Dict[str, Any]]:
    """
    Cherche une correspondance dans les règles statiques.
    Retourne un dict enrichi ou None si aucune correspondance.
    """
    desc_upper = description.upper().strip()
    rules = STATIC_RULES_CREDIT if is_credit else STATIC_RULES_DEBIT

    # Trier les clés par longueur décroissante (priorité aux patterns longs)
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
                "lettrage_reason": f"{'Facture/paiement identifié' if lettrage else 'Charge directe — pas de lettrage'}",
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
- 6393 FODEC
- 6615 Intérêts bancaires
- 651 Redevances pour licences et logiciels
- 691 Impôts sur les bénéfices
- 706 Prestations de services
- 707 Ventes de marchandises
- 756 Produits financiers

RÈGLES MÉTIER TUNISIENNES :
1. Un DÉBIT sur le relevé = sortie d'argent → Écriture : Débit CHARGE/Crédit 521 Banques
2. Un CRÉDIT sur le relevé = entrée d'argent → Écriture : Débit 521 Banques/Crédit PRODUIT ou 411
3. Si c'est un paiement fournisseur identifiable (nom fournisseur dans le libellé) → 401 + lettrage OUI
4. Si c'est un encaissement client → 411 + lettrage OUI
5. Les frais bancaires (commissions, agios, tenue de compte) → 627/6278/6615 + lettrage NON
6. Les salaires → 421 (personnel) + lettrage NON
7. CNSS/CNAM → 6341 + lettrage NON
8. Meta/Facebook/Google Ads → 6231 (Publicité)
9. Pièces auto, vidange, mécanique → 6155 (Entretien matériel transport)
10. Carburant (Shell, Total, Agil) → 6068 (Carburants)
11. STEG/électricité → 6061
12. Télécom (Ooredoo, TT, Orange) → 6262
13. Internet (TopNet, etc.) → 6264
14. Assurance → 616
15. Pour la classification intelligente, analyse le CONTEXTE du libellé, pas juste les mots-clés

Réponds UNIQUEMENT avec un JSON valide (pas de markdown) au format :
{{
  "analyses": [
    {{
      "index": 0,
      "operation_type": "paiement_fournisseur|paiement_client|frais_bancaires|salaire|charge_sociale|impot|tva|loyer|telecom|marketing|assurance|transport|retrait_especes|virement_interne|remboursement|charge_exploitation|produit_financier|autre",
      "piece_metier": "facture_fournisseur|facture_client|bulletin_paie|declaration_cnss|declaration_tva|declaration_fiscale|releve_bancaire|contrat_bail|facture_telecom|facture_publicite|police_assurance|facture_carburant|operation_caisse|ordre_virement|avoir|note_frais|ecriture_manuelle",
      "account_code": "401",
      "account_name": "Fournisseurs d'exploitation",
      "needs_lettrage": true,
      "lettrage_reason": "Paiement identifié comme règlement de facture fournisseur — à rapprocher",
      "confidence": "fort|moyen|faible",
      "explanation": "Courte explication de la classification (1 ligne)"
    }}
  ]
}}

IMPORTANT :
- L'index correspond à l'ordre des transactions envoyées (commence à 0)
- "needs_lettrage" = true si c'est un paiement de facture (client OU fournisseur)
- "needs_lettrage" = false si c'est une charge directe (frais, salaire, impôt...)
- Sois PRÉCIS sur les codes comptables. Utilise les sous-comptes quand c'est possible (6231 plutôt que 623)
- Pour "confidence": "fort" si le libellé est clair, "moyen" si probable, "faible" si ambigu
"""


async def analyze_transactions_with_gemini(
    transactions: List[Dict],
    api_key: str
) -> Optional[List[Dict]]:
    """
    Appelle Gemini pour analyser un batch de transactions bancaires.
    Retourne une liste de résultats d'analyse ou None en cas d'échec.
    """
    import asyncio

    def _sync_analyze():
        try:
            from google import genai
            from google.genai import types as gt

            client = genai.Client(api_key=api_key)

            # Préparer les transactions pour le prompt
            tx_for_prompt = []
            for i, tx in enumerate(transactions):
                tx_for_prompt.append({
                    "index": i,
                    "date": tx.get("date", ""),
                    "description": tx.get("description", ""),
                    "debit": float(tx.get("debit", 0)),
                    "credit": float(tx.get("credit", 0)),
                    "type": tx.get("type", tx.get("transaction_type", "autre")),
                })

            prompt = GEMINI_ANALYSIS_PROMPT.format(
                transactions_json=json.dumps(tx_for_prompt, ensure_ascii=False, indent=2)
            )

            # Essayer plusieurs modèles
            models = ["gemini-2.5-flash", "gemini-2.0-flash", "gemini-1.5-flash"]
            for model_name in models:
                try:
                    response = client.models.generate_content(
                        model=model_name,
                        contents=[prompt],
                        config=gt.GenerateContentConfig(
                            automatic_function_calling=gt.AutomaticFunctionCallingConfig(disable=True),
                            max_output_tokens=8192,
                        )
                    )
                    raw = (response.text or "").strip()
                    # Nettoyer markdown
                    if raw.startswith("```"):
                        raw = re.sub(r"^```(?:json)?\n?", "", raw)
                        raw = re.sub(r"\n?```$", "", raw.strip())

                    if not raw:
                        continue

                    data = json.loads(raw)
                    analyses = data.get("analyses", [])
                    logger.info(f"Gemini {model_name}: {len(analyses)} analyses retournées")
                    return analyses

                except Exception as e:
                    err = str(e)
                    if "429" in err or "RESOURCE_EXHAUSTED" in err:
                        continue
                    if "404" in err or "NOT_FOUND" in err:
                        continue
                    logger.warning(f"Gemini {model_name} erreur: {e}")
                    break

            return None

        except Exception as e:
            logger.warning(f"Gemini analysis échec: {e}")
            return None

    try:
        result = await asyncio.wait_for(asyncio.to_thread(_sync_analyze), timeout=120.0)
        return result
    except Exception as e:
        logger.warning(f"Gemini analysis timeout/erreur: {e}")
        return None


# ═══════════════════════════════════════════════════════════════════════════════
# MOTEUR PRINCIPAL — Combine static + IA
# ═══════════════════════════════════════════════════════════════════════════════

async def analyze_bank_transactions(
    transactions: List[Dict],
    use_ai: bool = True
) -> List[Dict]:
    """
    Analyse complète de chaque transaction bancaire.
    
    Stratégie :
    1. D'abord appliquer les règles statiques (rapide, fiable)
    2. Pour les transactions non classifiées ou à faible confiance → appel Gemini
    3. Fusionner les résultats (priorité IA si disponible, sinon statique)
    
    Retourne une liste enrichie avec les 5 réponses pour chaque transaction.
    """
    results = []
    unresolved_indices = []

    # ── Phase 1 : Règles statiques ──
    for i, tx in enumerate(transactions):
        desc = tx.get("description", "")
        debit = float(tx.get("debit", 0))
        credit = float(tx.get("credit", 0))
        is_credit = credit > 0

        static_match = _match_static_rules(desc, is_credit)

        if static_match and static_match["confidence"] == "fort":
            # Classification statique forte → on garde
            if is_credit:
                account_debit = "521"
                account_debit_name = "Banques"
                account_credit = static_match["account_code"]
                account_credit_name = static_match["account_name"]
            else:
                account_debit = static_match["account_code"]
                account_debit_name = static_match["account_name"]
                account_credit = "521"
                account_credit_name = "Banques"

            results.append({
                "index": i,
                "operation_type": static_match["operation_type"],
                "piece_metier": static_match["piece_metier"],
                "account_debit": account_debit,
                "account_debit_name": account_debit_name,
                "account_credit": account_credit,
                "account_credit_name": account_credit_name,
                "needs_lettrage": static_match["needs_lettrage"],
                "lettrage_reason": static_match["lettrage_reason"],
                "confidence": static_match["confidence"],
                "explanation": f"Règle statique: {static_match['matched_keyword']}",
                "source": "static_rules",
            })
        else:
            # Pas de match fort → marquer pour analyse IA
            unresolved_indices.append(i)
            # Mettre un placeholder avec match statique partiel si disponible
            if static_match:
                if is_credit:
                    results.append({
                        "index": i,
                        "operation_type": static_match["operation_type"],
                        "piece_metier": static_match["piece_metier"],
                        "account_debit": "521",
                        "account_debit_name": "Banques",
                        "account_credit": static_match["account_code"],
                        "account_credit_name": static_match["account_name"],
                        "needs_lettrage": static_match["needs_lettrage"],
                        "lettrage_reason": static_match["lettrage_reason"],
                        "confidence": static_match["confidence"],
                        "explanation": f"Règle statique partielle: {static_match['matched_keyword']}",
                        "source": "static_rules_partial",
                    })
                else:
                    results.append({
                        "index": i,
                        "operation_type": static_match["operation_type"],
                        "piece_metier": static_match["piece_metier"],
                        "account_debit": static_match["account_code"],
                        "account_debit_name": static_match["account_name"],
                        "account_credit": "521",
                        "account_credit_name": "Banques",
                        "needs_lettrage": static_match["needs_lettrage"],
                        "lettrage_reason": static_match["lettrage_reason"],
                        "confidence": static_match["confidence"],
                        "explanation": f"Règle statique partielle: {static_match['matched_keyword']}",
                        "source": "static_rules_partial",
                    })
            else:
                # Aucun match → défaut
                if is_credit:
                    results.append({
                        "index": i,
                        "operation_type": "autre",
                        "piece_metier": "ecriture_manuelle",
                        "account_debit": "521",
                        "account_debit_name": "Banques",
                        "account_credit": "411",
                        "account_credit_name": "Clients / Recette à identifier",
                        "needs_lettrage": False,
                        "lettrage_reason": "Transaction non identifiée — vérification manuelle requise",
                        "confidence": "faible",
                        "explanation": "Aucune correspondance trouvée",
                        "source": "default",
                    })
                else:
                    results.append({
                        "index": i,
                        "operation_type": "autre",
                        "piece_metier": "ecriture_manuelle",
                        "account_debit": "401",
                        "account_debit_name": "Fournisseurs / Charge à identifier",
                        "account_credit": "521",
                        "account_credit_name": "Banques",
                        "needs_lettrage": False,
                        "lettrage_reason": "Transaction non identifiée — vérification manuelle requise",
                        "confidence": "faible",
                        "explanation": "Aucune correspondance trouvée",
                        "source": "default",
                    })

    # ── Phase 2 : Analyse IA (Gemini) pour les non-résolus ──
    gemini_key = os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_AI_KEY")

    if use_ai and gemini_key and unresolved_indices:
        # Envoyer TOUTES les transactions à Gemini (contexte complet)
        # mais ne remplacer que les non-résolus
        ai_analyses = await analyze_transactions_with_gemini(transactions, gemini_key)

        if ai_analyses:
            # Indexer par position
            ai_by_index = {a["index"]: a for a in ai_analyses if "index" in a}

            for idx in unresolved_indices:
                if idx in ai_by_index:
                    ai = ai_by_index[idx]
                    is_credit = float(transactions[idx].get("credit", 0)) > 0

                    if is_credit:
                        account_debit = "521"
                        account_debit_name = "Banques"
                        account_credit = ai.get("account_code", "411")
                        account_credit_name = ai.get("account_name", "Clients")
                    else:
                        account_debit = ai.get("account_code", "401")
                        account_debit_name = ai.get("account_name", "Fournisseurs")
                        account_credit = "521"
                        account_credit_name = "Banques"

                    # Remplacer le placeholder
                    results[idx] = {
                        "index": idx,
                        "operation_type": ai.get("operation_type", "autre"),
                        "piece_metier": ai.get("piece_metier", "ecriture_manuelle"),
                        "account_debit": account_debit,
                        "account_debit_name": account_debit_name,
                        "account_credit": account_credit,
                        "account_credit_name": account_credit_name,
                        "needs_lettrage": ai.get("needs_lettrage", False),
                        "lettrage_reason": ai.get("lettrage_reason", ""),
                        "confidence": ai.get("confidence", "moyen"),
                        "explanation": ai.get("explanation", "Analyse IA"),
                        "source": "gemini_ai",
                    }

    # Trier par index
    results.sort(key=lambda x: x["index"])
    return results
```

### Points importants
- Le mapping statique couvre **80%** des cas courants tunisiens
- Gemini n'est appelé que pour les cas non résolus → économise des tokens
- Les résultats sont **toujours** retournés (même sans IA) grâce au fallback statique
- La variable d'env `GEMINI_API_KEY` est lue dynamiquement

---

## ÉTAPE 2 — Modifier `backend/routes/bank_reconciliation.py`

### Ce qui change
1. **Remplacer** `_suggest_accounts()` par l'appel au nouveau `bank_ai_engine`
2. **Ajouter** un endpoint `/api/bank-reconciliation/ai-analyze` pour re-analyser un relevé existant
3. **Enrichir** les transactions retournées avec les 5 questions

### Modifications précises

#### 2.1 — Import du nouveau service
En haut du fichier, ajouter :
```python
from services.bank_ai_engine import analyze_bank_transactions
```

#### 2.2 — Modifier la route `POST /parse` (après extraction des transactions)

Remplacer le bloc qui fait `_suggest_accounts()` (lignes ~800-825) par :

```python
    # ══════════════════════════════════════════════════════════════════════════
    # ANALYSE IA — Classification intelligente des transactions
    # ══════════════════════════════════════════════════════════════════════════
    transactions = extracted.get("transactions") or []
    
    # Lancer l'analyse IA (statique + Gemini)
    try:
        ai_analyses = await analyze_bank_transactions(transactions, use_ai=True)
    except Exception as e:
        logger.warning(f"AI analysis error: {e}")
        ai_analyses = []
    
    # Construire l'index des analyses
    ai_by_index = {a["index"]: a for a in ai_analyses}
    
    enriched = []
    for i, t in enumerate(transactions):
        ai = ai_by_index.get(i, {})
        
        enriched.append({
            "id": str(i),
            "date": t.get("date"),
            "value_date": t.get("value_date"),
            "reference": t.get("reference"),
            "description": t.get("description") or "",
            "debit": float(t.get("debit") or 0),
            "credit": float(t.get("credit") or 0),
            "balance": t.get("balance"),
            "transaction_type": t.get("type") or "autre",
            
            # ── Résultats de l'analyse IA ──
            "operation_type": ai.get("operation_type", "autre"),
            "piece_metier": ai.get("piece_metier", "ecriture_manuelle"),
            "account_debit": ai.get("account_debit", "521"),
            "account_debit_name": ai.get("account_debit_name", "Banques"),
            "account_credit": ai.get("account_credit", "521"),
            "account_credit_name": ai.get("account_credit_name", "Banques"),
            "needs_lettrage": ai.get("needs_lettrage", False),
            "lettrage_reason": ai.get("lettrage_reason", ""),
            "confidence": ai.get("confidence", "faible"),
            "ai_explanation": ai.get("explanation", ""),
            "ai_source": ai.get("source", "default"),
            
            # ── État de validation ──
            "matched_invoice_id": None,
            "matched_invoice_number": None,
            "validated": False,
            "lettered": False,
            
            # ── Opérations spéciales ──
            "is_cash_operation": ai.get("operation_type") in ("retrait_especes", "versement_especes"),
            "is_card_operation": ai.get("operation_type") == "achat_carte",
        })
```

#### 2.3 — Ajouter la route de re-analyse IA

```python
@router.post("/ai-analyze/{statement_id}")
async def ai_analyze_statement(
    statement_id: str,
    company_id: str = Query(...),
    current_user: dict = Depends(get_current_user)
):
    """Re-lance l'analyse IA sur un relevé bancaire existant."""
    await get_current_company(current_user, company_id)
    
    stmt = await db.bank_statements.find_one(
        {"_id": ObjectId(statement_id), "company_id": ObjectId(company_id)}
    )
    if not stmt:
        raise HTTPException(status_code=404, detail="Extrait non trouvé")
    
    transactions = stmt.get("transactions") or []
    
    # Relancer l'analyse IA
    ai_analyses = await analyze_bank_transactions(transactions, use_ai=True)
    ai_by_index = {a["index"]: a for a in ai_analyses}
    
    # Mettre à jour les transactions
    for i, t in enumerate(transactions):
        ai = ai_by_index.get(i, {})
        if ai:
            t["operation_type"] = ai.get("operation_type", t.get("operation_type", "autre"))
            t["piece_metier"] = ai.get("piece_metier", t.get("piece_metier", "ecriture_manuelle"))
            t["account_debit"] = ai.get("account_debit", t.get("account_debit", "521"))
            t["account_debit_name"] = ai.get("account_debit_name", t.get("account_debit_name", "Banques"))
            t["account_credit"] = ai.get("account_credit", t.get("account_credit", "521"))
            t["account_credit_name"] = ai.get("account_credit_name", t.get("account_credit_name", "Banques"))
            t["needs_lettrage"] = ai.get("needs_lettrage", False)
            t["lettrage_reason"] = ai.get("lettrage_reason", "")
            t["confidence"] = ai.get("confidence", "faible")
            t["ai_explanation"] = ai.get("explanation", "")
            t["ai_source"] = ai.get("source", "default")
    
    # Sauvegarder
    await db.bank_statements.update_one(
        {"_id": ObjectId(statement_id)},
        {"$set": {"transactions": transactions, "ai_analyzed": True}}
    )
    
    return {
        "message": f"Analyse IA terminée — {len(transactions)} transactions analysées",
        "transactions": transactions,
        "ai_stats": {
            "total": len(transactions),
            "fort": sum(1 for t in transactions if t.get("confidence") == "fort"),
            "moyen": sum(1 for t in transactions if t.get("confidence") == "moyen"),
            "faible": sum(1 for t in transactions if t.get("confidence") == "faible"),
        }
    }
```

---

## ÉTAPE 3 — Modifier le Frontend `BankReconciliation.js`

### 3.1 — Ajouter les labels et couleurs pour les types d'opérations

```javascript
const OPERATION_TYPES = {
  paiement_fournisseur: { label: 'Paiement fournisseur', color: 'bg-red-100 text-red-700', icon: '🏢' },
  paiement_client: { label: 'Paiement client', color: 'bg-green-100 text-green-700', icon: '👤' },
  frais_bancaires: { label: 'Frais bancaires', color: 'bg-gray-100 text-gray-600', icon: '🏦' },
  salaire: { label: 'Salaire', color: 'bg-blue-100 text-blue-700', icon: '💰' },
  charge_sociale: { label: 'Charge sociale', color: 'bg-purple-100 text-purple-700', icon: '🏥' },
  impot: { label: 'Impôt', color: 'bg-yellow-100 text-yellow-700', icon: '📋' },
  tva: { label: 'TVA', color: 'bg-yellow-100 text-yellow-700', icon: '📊' },
  loyer: { label: 'Loyer', color: 'bg-orange-100 text-orange-700', icon: '🏠' },
  telecom: { label: 'Télécom', color: 'bg-cyan-100 text-cyan-700', icon: '📱' },
  marketing: { label: 'Marketing / Pub', color: 'bg-pink-100 text-pink-700', icon: '📢' },
  assurance: { label: 'Assurance', color: 'bg-indigo-100 text-indigo-700', icon: '🛡️' },
  transport: { label: 'Transport', color: 'bg-amber-100 text-amber-700', icon: '🚗' },
  entretien_vehicule: { label: 'Entretien véhicule', color: 'bg-amber-100 text-amber-700', icon: '🔧' },
  retrait_especes: { label: 'Retrait espèces', color: 'bg-yellow-100 text-yellow-700', icon: '💵' },
  versement_especes: { label: 'Versement espèces', color: 'bg-green-100 text-green-700', icon: '💵' },
  virement_interne: { label: 'Virement interne', color: 'bg-blue-100 text-blue-700', icon: '🔄' },
  remboursement: { label: 'Remboursement', color: 'bg-green-100 text-green-700', icon: '↩️' },
  charge_exploitation: { label: 'Charge exploitation', color: 'bg-orange-100 text-orange-700', icon: '⚡' },
  produit_financier: { label: 'Produit financier', color: 'bg-emerald-100 text-emerald-700', icon: '📈' },
  honoraire: { label: 'Honoraires', color: 'bg-violet-100 text-violet-700', icon: '📝' },
  abonnement: { label: 'Abonnement / Licence', color: 'bg-sky-100 text-sky-700', icon: '💻' },
  fourniture_bureau: { label: 'Fournitures bureau', color: 'bg-slate-100 text-slate-700', icon: '📎' },
  retenue_source: { label: 'Retenue à la source', color: 'bg-yellow-100 text-yellow-700', icon: '🧾' },
  taxe: { label: 'Taxe', color: 'bg-yellow-100 text-yellow-700', icon: '📋' },
  achat_carte: { label: 'Achat par carte', color: 'bg-orange-100 text-orange-700', icon: '💳' },
  autre: { label: 'Autre', color: 'bg-gray-100 text-gray-500', icon: '❓' },
};

const CONFIDENCE_COLORS = {
  fort: 'bg-green-100 text-green-700 border-green-300',
  moyen: 'bg-yellow-100 text-yellow-700 border-yellow-300',
  faible: 'bg-red-100 text-red-700 border-red-300',
};
```

### 3.2 — Enrichir la table des transactions

Dans la table `<tbody>`, modifier chaque `<tr>` pour afficher :

```jsx
{/* Description + Analyse IA */}
<td className="px-3 py-2">
  <div className="max-w-xs">
    <p className="truncate font-medium">{t.description}</p>
    <div className="flex flex-wrap items-center gap-1.5 mt-1">
      {/* Type d'opération (avec icône) */}
      {t.operation_type && (
        <span className={`text-xs px-1.5 py-0.5 rounded-full ${
          (OPERATION_TYPES[t.operation_type] || OPERATION_TYPES.autre).color
        }`}>
          {(OPERATION_TYPES[t.operation_type] || OPERATION_TYPES.autre).icon}{' '}
          {(OPERATION_TYPES[t.operation_type] || OPERATION_TYPES.autre).label}
        </span>
      )}
      {/* Pièce métier */}
      {t.piece_metier && t.piece_metier !== 'ecriture_manuelle' && (
        <span className="text-xs px-1.5 py-0.5 rounded-full bg-violet-50 text-violet-600">
          📄 {t.piece_metier.replace(/_/g, ' ')}
        </span>
      )}
      {/* Confiance */}
      {t.confidence && (
        <span className={`text-xs px-1.5 py-0.5 rounded-full border ${
          CONFIDENCE_COLORS[t.confidence] || CONFIDENCE_COLORS.faible
        }`}>
          {t.confidence === 'fort' ? '✅' : t.confidence === 'moyen' ? '⚠️' : '❓'} {t.confidence}
        </span>
      )}
      {/* Lettrage */}
      {t.needs_lettrage && (
        <span className="text-xs px-1.5 py-0.5 rounded-full bg-blue-50 text-blue-600 border border-blue-200">
          🔗 Lettrage requis
        </span>
      )}
    </div>
    {/* Explication IA (tooltip ou texte discret) */}
    {t.ai_explanation && (
      <p className="text-xs text-gray-400 mt-0.5 italic truncate">{t.ai_explanation}</p>
    )}
  </div>
</td>
```

### 3.3 — Ajouter un bouton "Re-analyser avec IA"

Dans la barre d'actions du statement (à côté de "Valider X écritures") :

```jsx
<Button
  variant="outline"
  onClick={async () => {
    try {
      const res = await fetch(
        `${API}/api/bank-reconciliation/ai-analyze/${statement.statement_id}?company_id=${currentCompany.id}`,
        { method: 'POST', headers: { Authorization: `Bearer ${token()}` } }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail);
      setStatement(prev => ({ ...prev, transactions: data.transactions }));
      toast.success(`Analyse IA terminée — ${data.ai_stats.fort} fort, ${data.ai_stats.moyen} moyen, ${data.ai_stats.faible} faible`);
    } catch (e) {
      toast.error(e.message);
    }
  }}
  className="gap-1.5 border-violet-300 text-violet-700 hover:bg-violet-50"
>
  🤖 Re-analyser avec IA
</Button>
```

### 3.4 — Modal d'édition enrichie

Ajouter dans le modal d'édition les champs :
- Type d'opération (select avec toutes les options)
- Pièce métier (select)
- Lettrage oui/non (checkbox)
- Confiance (badge en lecture seule)

---

## ÉTAPE 4 — Variables d'environnement

S'assurer que `GEMINI_API_KEY` est configuré dans `backend/.env` :
```
GEMINI_API_KEY=votre_clé_ici
```

Le service lira aussi `GOOGLE_AI_KEY` comme fallback.

---

## RÉSUMÉ DES CHANGEMENTS

| Fichier | Action | Description |
|---------|--------|-------------|
| `backend/services/bank_ai_engine.py` | **CRÉER** | Moteur IA complet (statique + Gemini) |
| `backend/routes/bank_reconciliation.py` | **MODIFIER** | Intégrer `analyze_bank_transactions()` + route `/ai-analyze` |
| `frontend/src/pages/BankReconciliation.js` | **MODIFIER** | Afficher types, pièces, confiance, lettrage, bouton re-analyse |

---

## CONTRAINTES TECHNIQUES

1. **Ne PAS casser** les routes existantes (`/parse`, `/validate-entries`, `/lettrage`, `/lettrage-client`)
2. **Garder** la compatibilité avec les champs `account_debit`, `account_credit` déjà utilisés par le frontend
3. **Les nouvelles propriétés** (`operation_type`, `piece_metier`, `needs_lettrage`, `confidence`, `ai_explanation`) sont **additives** — elles n'écrasent rien d'existant
4. Le système doit fonctionner **même sans GEMINI_API_KEY** → fallback sur les règles statiques uniquement
5. **MongoDB** : les transactions enrichies sont sauvegardées dans `bank_statements.transactions[]`
6. **Batch Gemini** : envoyer toutes les transactions en un seul appel (pas un appel par ligne)
7. **Timeout** : 120 secondes max pour l'appel Gemini

---

## TEST

Après implémentation, tester avec :
1. Upload d'un relevé bancaire PDF → vérifier que les types d'opérations sont corrects
2. Upload d'une image de relevé → vérifier l'extraction Gemini
3. Vérifier que les comptes comptables proposés sont pertinents (Meta→6231, CNSS→6341, etc.)
4. Vérifier que le lettrage est proposé pour les paiements client/fournisseur
5. Vérifier que le bouton "Re-analyser avec IA" fonctionne
6. Tester SANS clé Gemini → vérifier que les règles statiques fonctionnent seules
