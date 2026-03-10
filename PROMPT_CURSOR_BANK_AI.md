# 🎯 PROMPT CURSOR — Agent Claude Opus
# Moteur IA d'analyse bancaire + Module RH complet (réglementation tunisienne)

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


---
---

# ═══════════════════════════════════════════════════════════════════════════════
# PARTIE 2 — MODULE RH COMPLET (Réglementation Tunisienne)
# ═══════════════════════════════════════════════════════════════════════════════

## CONTEXTE

EasyBill n'a actuellement **aucun module RH**. Il faut implémenter un module complet conforme à la réglementation tunisienne couvrant :
- Gestion des employés et contrats
- Paie avec toutes les rubriques légales
- Congés (tous types)
- Déclarations sociales (CNSS) et fiscales
- Génération des bulletins de paie PDF
- Intégration comptable automatique (écritures de paie)

### Architecture des fichiers à créer

```
backend/
├── models/
│   └── hr_models.py                    ← NOUVEAU : Modèles employés, contrats, paie, congés
├── services/
│   ├── payroll_engine.py               ← NOUVEAU : Moteur de calcul de paie tunisien
│   └── hr_declarations_service.py      ← NOUVEAU : Génération déclarations CNSS/fiscales
├── routes/
│   ├── hr_employees.py                 ← NOUVEAU : CRUD employés + contrats
│   ├── hr_payroll.py                   ← NOUVEAU : Bulletins de paie, calculs, historique
│   ├── hr_leave.py                     ← NOUVEAU : Gestion des congés
│   └── hr_declarations.py             ← NOUVEAU : Déclarations CNSS, IRPP, TFP, FOPROLOS
├── data/
│   └── tunisian_hr_config.py          ← NOUVEAU : Barèmes, taux, configurations légales
frontend/
└── src/pages/
    ├── HRDashboard.js                  ← NOUVEAU : Tableau de bord RH
    ├── Employees.js                    ← NOUVEAU : Liste et fiche employé
    ├── EmployeeDetail.js               ← NOUVEAU : Détail employé avec contrats
    ├── Payroll.js                      ← NOUVEAU : Génération et historique paie
    ├── PayslipDetail.js                ← NOUVEAU : Détail bulletin de paie
    ├── LeaveManagement.js              ← NOUVEAU : Gestion des congés
    └── HRDeclarations.js              ← NOUVEAU : Déclarations sociales/fiscales
```

---

## ÉTAPE 5 — Créer `backend/data/tunisian_hr_config.py`

Ce fichier contient **TOUTES les configurations légales tunisiennes** pour la paie et les RH.

```python
"""
tunisian_hr_config.py
Configuration légale pour la paie et les RH en Tunisie.
Conforme au Code du Travail tunisien, à la Loi de Finances 2025,
et aux régulations CNSS/CNAM en vigueur.

⚠️ IMPORTANT : Ces taux doivent être vérifiés et mis à jour
   à chaque nouvelle Loi de Finances ou modification réglementaire.
   Dernière mise à jour : Loi de Finances 2025
"""

# ═══════════════════════════════════════════════════════════════════════════════
# 1. TYPES DE CONTRATS DE TRAVAIL (Code du Travail Tunisien)
# ═══════════════════════════════════════════════════════════════════════════════

CONTRACT_TYPES = [
    {
        "code": "CDI",
        "name": "Contrat à Durée Indéterminée",
        "description": "Contrat standard sans date de fin. Période d'essai selon catégorie professionnelle.",
        "trial_period_months": {
            "ouvrier": 6,       # 6 mois renouvelable 1 fois
            "employe": 6,
            "maitrisant": 6,
            "cadre": 9,         # 9 mois renouvelable 1 fois
            "cadre_superieur": 12
        },
        "cnss_applicable": True,
        "irpp_applicable": True,
        "leave_applicable": True,
        "notice_period_months": {
            "ouvrier": 1,
            "employe": 1,
            "cadre": 3,
            "cadre_superieur": 3
        },
        "max_duration": None,  # Illimité
        "renewable": False,     # N/A
        "regulations": "Articles 6-6ter du Code du Travail"
    },
    {
        "code": "CDD",
        "name": "Contrat à Durée Déterminée",
        "description": "Contrat avec date de fin. Maximum 4 ans (renouvellements inclus). Au-delà → CDI automatique.",
        "max_duration_years": 4,
        "cnss_applicable": True,
        "irpp_applicable": True,
        "leave_applicable": True,
        "renewable": True,
        "auto_cdi_after_max": True,
        "indemnite_precarite": 0,  # Pas d'indemnité de précarité en Tunisie (contrairement à la France)
        "regulations": "Articles 6-4 à 6-6 du Code du Travail"
    },
    {
        "code": "CIVP",
        "name": "Contrat d'Initiation à la Vie Professionnelle",
        "description": "Pour primo-demandeurs d'emploi diplômés. L'État prend en charge une partie du salaire. Durée : 12 mois max, renouvelable 1 fois.",
        "max_duration_months": 24,  # 12 + 12 renouvellement
        "state_contribution_percent": 50,  # L'État paie 50% du salaire (plafond SMIG)
        "cnss_applicable": True,    # Cotisations CNSS réduites
        "cnss_employer_rate_override": 0,  # Exonération patronale CNSS pendant la durée
        "irpp_applicable": True,
        "leave_applicable": True,
        "eligible": "Diplômés (Bac+2 minimum) primo-demandeurs inscrits au bureau d'emploi",
        "regulations": "Décret n° 2009-349 et ses modifications"
    },
    {
        "code": "CAIP",
        "name": "Contrat d'Adaptation et d'Insertion Professionnelle",
        "description": "Stage de formation-insertion en entreprise. L'État verse une indemnité au stagiaire.",
        "max_duration_months": 12,
        "state_funded": True,
        "state_monthly_allowance": 200,  # Indemnité mensuelle État (TND)
        "employer_supplement": True,     # L'employeur peut compléter
        "cnss_applicable": False,        # Pas de CNSS pendant le CAIP
        "irpp_applicable": False,
        "leave_applicable": False,
        "eligible": "Demandeurs d'emploi sans qualification ou en reconversion",
        "regulations": "Programme ANETI"
    },
    {
        "code": "SIVP",
        "name": "Stage d'Initiation à la Vie Professionnelle",
        "description": "Stage en entreprise pour les diplômés du supérieur. Indemnité mensuelle 150-300 TND prise en charge par l'État.",
        "max_duration_months": 24,
        "state_funded": True,
        "state_monthly_allowance_range": [150, 300],
        "cnss_applicable": False,
        "irpp_applicable": False,
        "leave_applicable": False,
        "eligible": "Diplômés de l'enseignement supérieur inscrits au bureau d'emploi",
        "regulations": "Loi n° 93-11 et ses modifications"
    },
    {
        "code": "CTT",
        "name": "Contrat de Travail Temporaire (Intérim)",
        "description": "Via une entreprise de travail temporaire. Limité aux cas prévus par la loi (remplacement, surcroît d'activité).",
        "max_duration_months": 4,
        "cnss_applicable": True,
        "irpp_applicable": True,
        "leave_applicable": True,
        "renewable": True,
        "max_renewals": 2,
        "regulations": "Articles 29 à 31 du Code du Travail"
    },
    {
        "code": "TEMPS_PARTIEL",
        "name": "Contrat à Temps Partiel",
        "description": "Durée de travail inférieure à la durée légale (48h/semaine ou 40h selon secteur). Prorata des droits.",
        "min_hours_weekly": 16,
        "cnss_applicable": True,
        "irpp_applicable": True,
        "leave_applicable": True,  # Au prorata
        "prorata": True,
        "regulations": "Article 94-2 du Code du Travail"
    },
    {
        "code": "SAISONNIER",
        "name": "Contrat Saisonnier",
        "description": "Pour des activités saisonnières (agriculture, tourisme, etc.). Durée limitée à la saison.",
        "max_duration_months": 6,
        "cnss_applicable": True,
        "irpp_applicable": True,
        "leave_applicable": True,
        "regulations": "Code du Travail — travail saisonnier"
    },
    {
        "code": "APPRENTISSAGE",
        "name": "Contrat d'Apprentissage",
        "description": "Formation alternance en entreprise. Indemnité minimale = 2/3 du SMIG la 1ère année, 3/4 la 2ème.",
        "max_duration_years": 4,
        "min_age": 15,
        "max_age": 20,
        "cnss_applicable": True,  # Cotisations réduites
        "irpp_applicable": False,
        "leave_applicable": True,
        "indemnity_year1_percent_smig": 66.7,
        "indemnity_year2_percent_smig": 75,
        "regulations": "Loi n° 93-10 relative à l'apprentissage"
    },
    {
        "code": "STAGE_CONV",
        "name": "Convention de Stage",
        "description": "Stage académique (formation initiale). Pas de contrat de travail au sens strict. Gratification possible.",
        "max_duration_months": 6,
        "cnss_applicable": False,
        "irpp_applicable": False,
        "leave_applicable": False,
        "is_employment_contract": False,
        "regulations": "Convention tripartite (étudiant, établissement, entreprise)"
    },
    {
        "code": "KARAMA",
        "name": "Contrat Karama (Programme Dignité)",
        "description": "Programme gouvernemental d'aide à l'emploi. Subvention étatique pour encourager l'embauche.",
        "max_duration_months": 24,
        "state_funded": True,
        "cnss_applicable": True,
        "irpp_applicable": True,
        "leave_applicable": True,
        "regulations": "Programme ANETI — Karama"
    }
]


# ═══════════════════════════════════════════════════════════════════════════════
# 2. BARÈME IRPP 2025 (Impôt sur le Revenu des Personnes Physiques)
#    Conforme à la Loi de Finances 2025
# ═══════════════════════════════════════════════════════════════════════════════

IRPP_BRACKETS_2025 = [
    {"min": 0,      "max": 5000,    "rate": 0},       # 0%
    {"min": 5000.001, "max": 20000, "rate": 26},      # 26%
    {"min": 20000.001, "max": 30000, "rate": 28},     # 28%
    {"min": 30000.001, "max": 50000, "rate": 32},     # 32%
    {"min": 50000.001, "max": None,  "rate": 35},     # 35%
]

# Contribution Sociale de Solidarité (CSS) — Loi de Finances 2018, maintenue en 2025
CSS_RATE = 1.0  # 1% du revenu net imposable

# Déductions pour charges de famille (annuelles)
FAMILY_DEDUCTIONS = {
    "chef_de_famille": 300,        # Chef de famille marié : 300 TND/an
    "conjoint_sans_revenu": 260,   # Conjoint à charge sans revenu : 260 TND/an
    "enfant_1": 100,               # 1er enfant à charge : 100 TND/an
    "enfant_2": 100,               # 2ème enfant : 100 TND/an
    "enfant_3": 100,               # 3ème enfant : 100 TND/an
    "enfant_4": 100,               # 4ème enfant : 100 TND/an
    "enfant_handicape": 2000,      # Enfant handicapé : 2000 TND/an
    "parent_a_charge": 150,        # Parent à charge : 150 TND/an
    "etudiant_sans_bourse": 1000,  # Enfant étudiant sans bourse : 1000 TND/an
    "max_enfants": 4,              # Maximum 4 enfants déductibles
}


# ═══════════════════════════════════════════════════════════════════════════════
# 3. COTISATIONS CNSS — Régime Général des Salariés
#    (Caisse Nationale de Sécurité Sociale)
# ═══════════════════════════════════════════════════════════════════════════════

CNSS_RATES = {
    "regime_general": {
        "name": "Régime général CNSS",
        "employee_rate": 9.18,       # Part salariale totale : 9,18%
        "employer_rate": 16.57,      # Part patronale totale : 16,57%
        "total_rate": 25.75,
        "breakdown": {
            "assurance_vieillesse_invalidite_survivants": {
                "employee": 4.74,
                "employer": 7.76,
            },
            "assurance_maladie_maternite_deces": {
                "employee": 3.17,
                "employer": 5.08,
            },
            "prestations_familiales": {
                "employee": 0,
                "employer": 2.61,
            },
            "accidents_travail_maladies_professionnelles": {
                "employee": 0,
                "employer": 0.5,   # Taux de base — varie de 0.5% à 5% selon le secteur d'activité
            },
            "assurance_chomage": {
                "employee": 1.27,
                "employer": 0.62,
            },
        },
        "plafond_mensuel": None,  # Pas de plafond en Tunisie pour le régime général
    },
    "regime_agricole": {
        "name": "Régime agricole",
        "employee_rate": 3.96,
        "employer_rate": 9.74,
        "total_rate": 13.70,
    },
    "regime_non_salaries": {
        "name": "Régime des non-salariés (TNS)",
        "contribution_rate": 14.71,
        "plafond_annuel": None,
    },
}

# Taux d'accident du travail par secteur (part patronale)
CNSS_ACCIDENT_RATES_BY_SECTOR = {
    "bureau_administration": 0.5,
    "commerce": 1.0,
    "industrie_legere": 1.5,
    "industrie_lourde": 2.0,
    "batiment_travaux_publics": 3.0,
    "mines_carrieres": 4.0,
    "activites_dangereuses": 5.0,
}


# ═══════════════════════════════════════════════════════════════════════════════
# 4. TAXES PARAFISCALES SUR LES SALAIRES (part patronale)
# ═══════════════════════════════════════════════════════════════════════════════

PAYROLL_TAXES = {
    "TFP": {
        "name": "Taxe de Formation Professionnelle",
        "rate": 2.0,          # 2% de la masse salariale brute (industrie)
        "rate_other": 1.0,    # 1% pour les autres secteurs
        "base": "salaire_brut",
        "payer": "employer",
        "declaration": "mensuelle",
        "compte_comptable": "6358",
        "regulations": "Loi n° 88-145"
    },
    "FOPROLOS": {
        "name": "Fonds de Promotion du Logement pour les Salariés",
        "rate": 1.0,          # 1% de la masse salariale brute
        "base": "salaire_brut",
        "payer": "employer",
        "declaration": "mensuelle",
        "compte_comptable": "6358",
        "regulations": "Loi n° 77-54"
    },
    "contribution_conjoncturelle": {
        "name": "Contribution conjoncturelle exceptionnelle",
        "rate": 0,            # 0% sauf si réactivée par une Loi de Finances
        "comment": "Vérifier chaque Loi de Finances — parfois activée temporairement"
    }
}


# ═══════════════════════════════════════════════════════════════════════════════
# 5. SMIG / SMAG — Salaire Minimum (dernière revalorisation)
# ═══════════════════════════════════════════════════════════════════════════════

MINIMUM_WAGES = {
    "SMIG_48H": {
        "name": "SMIG — Régime 48 heures/semaine",
        "monthly": 472.368,   # TND/mois (dernière revalorisation mai 2023)
        "hourly": 2.271,      # TND/heure
        "regime": "48h/semaine",
        "comment": "Vérifier les revalorisations annuelles — généralement en mai"
    },
    "SMIG_40H": {
        "name": "SMIG — Régime 40 heures/semaine",
        "monthly": 407.944,
        "hourly": 2.353,
        "regime": "40h/semaine",
    },
    "SMAG": {
        "name": "SMAG — Salaire Minimum Agricole Garanti",
        "daily": 16.856,
        "regime": "journalier",
    }
}


# ═══════════════════════════════════════════════════════════════════════════════
# 6. CONGÉS — Droits selon le Code du Travail Tunisien
# ═══════════════════════════════════════════════════════════════════════════════

LEAVE_TYPES = [
    {
        "code": "ANNUEL",
        "name": "Congé annuel payé",
        "base_days": 12,          # 1 jour ouvrable par mois de travail effectif (minimum 12 j/an)
        "unit": "jours_ouvrables",
        "paid": True,
        "accumulation": "par_mois_travaille",
        "seniority_bonus": [
            {"years": 5, "extra_days": 1},    # +1 jour après 5 ans
            {"years": 10, "extra_days": 2},   # +2 jours après 10 ans (cumulatif)
            {"years": 15, "extra_days": 3},
            {"years": 20, "extra_days": 4},
            {"years": 25, "extra_days": 5},
        ],
        "max_accumulation_months": 24,  # 2 ans maximum de report
        "regulations": "Articles 112 à 133 du Code du Travail"
    },
    {
        "code": "MALADIE",
        "name": "Congé maladie",
        "max_days_per_year": None,  # Selon certificat médical
        "paid": True,
        "paid_conditions": "Couvert par CNSS après carence de 5 jours. Indemnité = 66,7% du salaire journalier moyen.",
        "cnss_coverage": {
            "carence_days": 5,
            "rate_percent": 66.7,
            "max_days": 180,         # 180 jours max sur 12 mois
            "extension_chronic": 360  # 360 jours pour maladies chroniques
        },
        "certificate_required": True,
        "regulations": "Loi n° 60-30 sur la sécurité sociale"
    },
    {
        "code": "MATERNITE",
        "name": "Congé maternité",
        "duration_days": 60,         # 60 jours (30 jours pré + 30 jours post, extensible)
        "paid": True,
        "paid_by": "cnss",
        "cnss_rate_percent": 66.7,
        "extensions": "Prolongeable de 15 jours sur prescription médicale",
        "protection": "Interdiction de licencier pendant la grossesse et le congé maternité",
        "regulations": "Articles 64-68 du Code du Travail + Loi 2017 (extension)"
    },
    {
        "code": "PATERNITE",
        "name": "Congé paternité",
        "duration_days": 2,          # 2 jours ouvrables (naissance)
        "paid": True,
        "paid_by": "employer",
        "comment": "Vérifier si la Loi de Finances 2025 a étendu ce congé",
        "regulations": "Conventions collectives — minimum légal 2 jours"
    },
    {
        "code": "MARIAGE",
        "name": "Congé pour mariage",
        "duration_days": 3,
        "paid": True,
        "paid_by": "employer",
        "comment": "Mariage de l'employé. Peut être étendu par convention collective.",
        "regulations": "Conventions collectives"
    },
    {
        "code": "MARIAGE_ENFANT",
        "name": "Congé pour mariage d'un enfant",
        "duration_days": 1,
        "paid": True,
        "paid_by": "employer",
    },
    {
        "code": "DECES_CONJOINT",
        "name": "Congé pour décès du conjoint ou d'un enfant",
        "duration_days": 3,
        "paid": True,
        "paid_by": "employer",
    },
    {
        "code": "DECES_PARENT",
        "name": "Congé pour décès père/mère/frère/sœur",
        "duration_days": 3,
        "paid": True,
        "paid_by": "employer",
    },
    {
        "code": "NAISSANCE",
        "name": "Congé pour naissance d'un enfant",
        "duration_days": 2,
        "paid": True,
        "paid_by": "employer",
        "comment": "Identique au congé paternité dans la pratique"
    },
    {
        "code": "CIRCONCISION",
        "name": "Congé pour circoncision d'un enfant",
        "duration_days": 1,
        "paid": True,
        "paid_by": "employer",
    },
    {
        "code": "PELERINAGE",
        "name": "Congé pour pèlerinage (Hajj/Omra)",
        "duration_days": 30,
        "paid": False,
        "frequency": "1 fois dans la carrière",
        "regulations": "Article 131 du Code du Travail"
    },
    {
        "code": "SANS_SOLDE",
        "name": "Congé sans solde",
        "max_days": None,
        "paid": False,
        "approval_required": True,
        "comment": "Sur accord de l'employeur. Suspension du contrat de travail."
    },
    {
        "code": "FORMATION",
        "name": "Congé de formation",
        "max_days_per_year": 10,
        "paid": True,
        "conditions": "Formation professionnelle en rapport avec l'activité",
        "regulations": "Loi n° 93-10"
    },
    {
        "code": "SYNDICAL",
        "name": "Congé syndical",
        "max_days_per_year": 6,
        "paid": True,
        "conditions": "Pour les délégués syndicaux — activités syndicales",
        "regulations": "Article 170 du Code du Travail"
    },
    {
        "code": "ALLAITEMENT",
        "name": "Repos d'allaitement",
        "duration_months": 12,
        "daily_break_minutes": 60,  # 2 repos de 30 min par jour
        "paid": True,
        "comment": "Pendant 1 an après l'accouchement. 2 pauses de 30 min/jour.",
        "regulations": "Article 64 du Code du Travail"
    },
]

# Jours fériés légaux tunisiens (payés et chômés)
PUBLIC_HOLIDAYS = [
    {"date": "01-01", "name": "Jour de l'An", "fixed": True},
    {"date": "01-14", "name": "Fête de la Révolution et de la Jeunesse", "fixed": True},
    {"date": "03-20", "name": "Fête de l'Indépendance", "fixed": True},
    {"date": "04-09", "name": "Journée des Martyrs", "fixed": True},
    {"date": "05-01", "name": "Fête du Travail", "fixed": True},
    {"date": "07-25", "name": "Fête de la République", "fixed": True},
    {"date": "08-13", "name": "Fête de la Femme", "fixed": True},
    {"date": "10-15", "name": "Fête de l'Évacuation", "fixed": True},
    # Fêtes religieuses (dates variables — calcul lunaire)
    {"date": "variable", "name": "Aïd el-Fitr (fin Ramadan)", "fixed": False, "duration_days": 2},
    {"date": "variable", "name": "Aïd el-Adha", "fixed": False, "duration_days": 2},
    {"date": "variable", "name": "Mouled (Naissance du Prophète)", "fixed": False, "duration_days": 1},
    {"date": "variable", "name": "Ras el-Am el-Hijri (Nouvel An hégirien)", "fixed": False, "duration_days": 1},
]


# ═══════════════════════════════════════════════════════════════════════════════
# 7. RUBRIQUES DE PAIE — Gains et Retenues
# ═══════════════════════════════════════════════════════════════════════════════

PAYROLL_RUBRICS = {
    # ── GAINS (augmentent le brut) ──
    "gains": [
        {
            "code": "SAL_BASE",
            "name": "Salaire de base",
            "type": "gain",
            "taxable": True,
            "cnss_subject": True,
            "mandatory": True,
            "calculation": "Montant fixe mensuel selon contrat",
        },
        {
            "code": "PRIM_ANCIENNETE",
            "name": "Prime d'ancienneté",
            "type": "gain",
            "taxable": True,
            "cnss_subject": True,
            "mandatory": False,
            "calculation": "Selon convention collective. Généralement : 2% après 2 ans, +1% par an après 5 ans, plafonnée à 15-25%",
            "rates": [
                {"years": 2, "rate": 2},
                {"years": 5, "rate": 5},
                {"years": 10, "rate": 10},
                {"years": 15, "rate": 15},
                {"years": 20, "rate": 20},
            ]
        },
        {
            "code": "PRIM_RENDEMENT",
            "name": "Prime de rendement / productivité",
            "type": "gain",
            "taxable": True,
            "cnss_subject": True,
            "mandatory": False,
        },
        {
            "code": "PRIM_TRANSPORT",
            "name": "Prime de transport",
            "type": "gain",
            "taxable": True,      # Imposable au-delà de certains plafonds
            "cnss_subject": True,
            "mandatory": False,
            "comment": "Exonération IRPP possible jusqu'à un plafond fixé par la loi"
        },
        {
            "code": "PRIM_PANIER",
            "name": "Prime de panier / Indemnité de restauration",
            "type": "gain",
            "taxable": True,
            "cnss_subject": True,
            "mandatory": False,
        },
        {
            "code": "PRIM_PRESENCE",
            "name": "Prime de présence / assiduité",
            "type": "gain",
            "taxable": True,
            "cnss_subject": True,
            "mandatory": False,
        },
        {
            "code": "PRIM_RESPONSABILITE",
            "name": "Prime de responsabilité",
            "type": "gain",
            "taxable": True,
            "cnss_subject": True,
            "mandatory": False,
        },
        {
            "code": "PRIM_RISQUE",
            "name": "Prime de risque / danger",
            "type": "gain",
            "taxable": True,
            "cnss_subject": True,
            "mandatory": False,
        },
        {
            "code": "PRIM_SALISSURE",
            "name": "Prime de salissure",
            "type": "gain",
            "taxable": True,
            "cnss_subject": True,
            "mandatory": False,
        },
        {
            "code": "INDEMNITE_LOGEMENT",
            "name": "Indemnité de logement",
            "type": "gain",
            "taxable": True,
            "cnss_subject": True,
            "mandatory": False,
        },
        {
            "code": "INDEMNITE_REPRESENTATION",
            "name": "Indemnité de représentation",
            "type": "gain",
            "taxable": True,
            "cnss_subject": True,
            "mandatory": False,
        },
        {
            "code": "HEURES_SUP_25",
            "name": "Heures supplémentaires à 25%",
            "type": "gain",
            "taxable": True,
            "cnss_subject": True,
            "mandatory": False,
            "overtime_rate": 1.25,
            "conditions": "Heures au-delà de la durée légale (48h ou 40h) — jours ouvrables",
        },
        {
            "code": "HEURES_SUP_50",
            "name": "Heures supplémentaires à 50%",
            "type": "gain",
            "taxable": True,
            "cnss_subject": True,
            "mandatory": False,
            "overtime_rate": 1.50,
            "conditions": "Heures de nuit (21h-6h) ou samedi après-midi"
        },
        {
            "code": "HEURES_SUP_75",
            "name": "Heures supplémentaires à 75%",
            "type": "gain",
            "taxable": True,
            "cnss_subject": True,
            "mandatory": False,
            "overtime_rate": 1.75,
            "conditions": "Dimanches et jours fériés"
        },
        {
            "code": "HEURES_SUP_100",
            "name": "Heures supplémentaires à 100%",
            "type": "gain",
            "taxable": True,
            "cnss_subject": True,
            "mandatory": False,
            "overtime_rate": 2.00,
            "conditions": "Nuit des dimanches et jours fériés"
        },
        {
            "code": "TREIZIEME_MOIS",
            "name": "13ème mois / Gratification annuelle",
            "type": "gain",
            "taxable": True,
            "cnss_subject": True,
            "mandatory": False,
            "frequency": "annuelle",
        },
        {
            "code": "CONGE_PAYE",
            "name": "Indemnité de congés payés",
            "type": "gain",
            "taxable": True,
            "cnss_subject": True,
            "mandatory": True,
            "calculation": "1/12 du salaire brut annuel ou salaire pendant la période de congé",
        },
        {
            "code": "AVANTAGE_NATURE",
            "name": "Avantages en nature",
            "type": "gain",
            "taxable": True,
            "cnss_subject": True,
            "mandatory": False,
            "comment": "Voiture de fonction, logement, téléphone — évaluation forfaitaire",
        },
    ],

    # ── RETENUES (diminuent le net) ──
    "deductions": [
        {
            "code": "CNSS_SAL",
            "name": "Cotisation CNSS salariale",
            "type": "deduction",
            "mandatory": True,
            "rate": 9.18,
            "base": "salaire_brut_soumis_cnss",
            "compte_comptable": "431",
        },
        {
            "code": "IRPP",
            "name": "Retenue à la source IRPP",
            "type": "deduction",
            "mandatory": True,
            "calculation": "Barème progressif annualisé appliqué mensuellement",
            "base": "salaire_imposable",  # Brut - CNSS salariale - frais professionnels (10% plafonné)
            "compte_comptable": "4353",
        },
        {
            "code": "CSS",
            "name": "Contribution Sociale de Solidarité",
            "type": "deduction",
            "mandatory": True,
            "rate": 1.0,  # 1% du revenu net imposable
            "base": "revenu_net_imposable",
            "compte_comptable": "4353",
        },
        {
            "code": "AVANCE_SALAIRE",
            "name": "Avance sur salaire",
            "type": "deduction",
            "mandatory": False,
            "calculation": "Montant fixe — remboursement d'avance",
        },
        {
            "code": "PRET",
            "name": "Remboursement de prêt",
            "type": "deduction",
            "mandatory": False,
            "calculation": "Mensualité fixe de remboursement",
        },
        {
            "code": "CESSION_SALAIRE",
            "name": "Cession sur salaire",
            "type": "deduction",
            "mandatory": False,
            "max_percent": 33.33,  # Maximum 1/3 du salaire cessible
            "regulations": "Code des Obligations et des Contrats"
        },
        {
            "code": "RET_SYNDICALE",
            "name": "Cotisation syndicale",
            "type": "deduction",
            "mandatory": False,
            "calculation": "Montant fixe ou pourcentage selon syndicat",
        },
        {
            "code": "MUTUELLE",
            "name": "Cotisation mutuelle complémentaire",
            "type": "deduction",
            "mandatory": False,
        },
        {
            "code": "OPPOSITION",
            "name": "Opposition sur salaire (saisie-arrêt)",
            "type": "deduction",
            "mandatory": False,
            "comment": "Décision judiciaire — montant fixé par le tribunal",
            "max_percent": 33.33,
        },
    ],

    # ── CHARGES PATRONALES (pas sur le bulletin mais à calculer) ──
    "employer_charges": [
        {
            "code": "CNSS_PAT",
            "name": "Cotisation CNSS patronale",
            "rate": 16.57,
            "base": "salaire_brut_soumis_cnss",
            "compte_comptable": "6341",
        },
        {
            "code": "TFP",
            "name": "Taxe de Formation Professionnelle",
            "rate": 2.0,  # ou 1% selon secteur
            "base": "salaire_brut",
            "compte_comptable": "6358",
        },
        {
            "code": "FOPROLOS",
            "name": "FOPROLOS",
            "rate": 1.0,
            "base": "salaire_brut",
            "compte_comptable": "6358",
        },
    ]
}


# ═══════════════════════════════════════════════════════════════════════════════
# 8. FORMULE DE CALCUL DU NET À PAYER
# ═══════════════════════════════════════════════════════════════════════════════

"""
FORMULE DE PAIE TUNISIENNE :

SALAIRE BRUT = Salaire de base + Primes + Heures sup + Indemnités + Avantages en nature

SALAIRE BRUT SOUMIS CNSS = Salaire brut (pas de plafond en régime général)

CNSS SALARIALE = Salaire brut soumis CNSS × 9,18%

SALAIRE IMPOSABLE (assiette IRPP) :
  = Salaire brut
  - CNSS salariale
  - Frais professionnels (déduction forfaitaire 10% du brut, plafonnée à 2000 TND/an)
  - Déductions familiales (chef de famille, enfants...)

IRPP MENSUEL :
  = (Barème progressif appliqué au salaire imposable × 12) / 12
  (On annualise, on applique le barème, on divise par 12)

CSS = Salaire imposable × 1%

NET À PAYER :
  = Salaire brut
  - CNSS salariale (9,18%)
  - IRPP (retenue à la source)
  - CSS (1%)
  - Autres retenues (avances, prêts, oppositions...)

CHARGES PATRONALES (hors bulletin, mais à comptabiliser) :
  = CNSS patronale (16,57%)
  + TFP (1% ou 2%)
  + FOPROLOS (1%)
  = Total ≈ 19,57% à 20,57% du brut
"""

# Frais professionnels (déduction forfaitaire IRPP)
PROFESSIONAL_EXPENSES_DEDUCTION = {
    "rate": 10,                # 10% du salaire brut
    "annual_cap": 2000,        # Plafonné à 2000 TND/an
    "monthly_cap": 166.667,    # 2000/12 ≈ 166,67 TND/mois
}


# ═══════════════════════════════════════════════════════════════════════════════
# 9. DÉCLARATIONS OBLIGATOIRES
# ═══════════════════════════════════════════════════════════════════════════════

MANDATORY_DECLARATIONS = [
    {
        "code": "DECL_CNSS_TRIM",
        "name": "Déclaration trimestrielle CNSS (DS7)",
        "frequency": "trimestrielle",
        "deadlines": {
            "T1": "15 avril",      # Janvier-Mars
            "T2": "15 juillet",    # Avril-Juin
            "T3": "15 octobre",    # Juillet-Septembre
            "T4": "15 janvier",    # Octobre-Décembre
        },
        "content": "Liste nominative des salariés, salaires bruts, cotisations salariales et patronales",
        "penalty": "10% de majoration + 1% par mois de retard",
        "format": "Formulaire DS7 (papier ou télédéclaration sur cnss.tn)"
    },
    {
        "code": "DECL_IRPP_MENSUEL",
        "name": "Déclaration mensuelle d'employeur (retenues IRPP + TFP + FOPROLOS)",
        "frequency": "mensuelle",
        "deadline": "15 du mois suivant",
        "content": "Total des retenues à la source IRPP + TFP + FOPROLOS du mois",
        "format": "Formulaire de déclaration mensuelle — recette des finances"
    },
    {
        "code": "DECL_ANNUELLE",
        "name": "Déclaration annuelle des salaires (Formulaire employeur)",
        "frequency": "annuelle",
        "deadline": "28 février de l'année N+1",
        "content": "Récapitulatif annuel de tous les salaires versés, retenues effectuées, par salarié",
        "format": "Déclaration de l'employeur — format réglementaire"
    },
    {
        "code": "CERTIF_RETENUE",
        "name": "Certificat de retenue à la source",
        "frequency": "annuelle",
        "deadline": "28 février de l'année N+1",
        "content": "Certificat individuel remis à chaque salarié (brut, CNSS, IRPP, net)",
        "mandatory_for_employee": True,
    },
    {
        "code": "DECL_EMBAUCHE",
        "name": "Déclaration d'embauche",
        "frequency": "événementielle",
        "deadline": "Dans les 48 heures suivant l'embauche",
        "destination": "ANETI (Agence Nationale pour l'Emploi et le Travail Indépendant)",
    },
    {
        "code": "DECL_DEPART",
        "name": "Déclaration de départ (fin de contrat)",
        "frequency": "événementielle",
        "deadline": "Dans les 15 jours suivant le départ",
        "content": "Certificat de travail + solde de tout compte + attestation CNSS",
    },
]


# ═══════════════════════════════════════════════════════════════════════════════
# 10. CATÉGORIES PROFESSIONNELLES (Classification conventionnelle)
# ═══════════════════════════════════════════════════════════════════════════════

PROFESSIONAL_CATEGORIES = [
    {"code": "OS1", "name": "Ouvrier spécialisé 1", "level": 1, "group": "execution"},
    {"code": "OS2", "name": "Ouvrier spécialisé 2", "level": 2, "group": "execution"},
    {"code": "OP1", "name": "Ouvrier professionnel 1", "level": 3, "group": "execution"},
    {"code": "OP2", "name": "Ouvrier professionnel 2", "level": 4, "group": "execution"},
    {"code": "OP3", "name": "Ouvrier professionnel 3", "level": 5, "group": "execution"},
    {"code": "EMP1", "name": "Employé 1", "level": 6, "group": "execution"},
    {"code": "EMP2", "name": "Employé 2", "level": 7, "group": "execution"},
    {"code": "EMP3", "name": "Employé qualifié", "level": 8, "group": "execution"},
    {"code": "AM1", "name": "Agent de maîtrise 1", "level": 9, "group": "maitrise"},
    {"code": "AM2", "name": "Agent de maîtrise 2", "level": 10, "group": "maitrise"},
    {"code": "AM3", "name": "Agent de maîtrise 3", "level": 11, "group": "maitrise"},
    {"code": "CAD1", "name": "Cadre débutant", "level": 12, "group": "cadre"},
    {"code": "CAD2", "name": "Cadre confirmé", "level": 13, "group": "cadre"},
    {"code": "CAD3", "name": "Cadre supérieur", "level": 14, "group": "cadre"},
    {"code": "DIR", "name": "Directeur / Dirigeant", "level": 15, "group": "direction"},
]
```

---

## ÉTAPE 6 — Créer le moteur de calcul de paie `backend/services/payroll_engine.py`

### Spécification

```python
"""
payroll_engine.py
Moteur de calcul de paie conforme à la réglementation tunisienne.

Ce service :
1. Calcule le salaire brut (base + primes + heures sup)
2. Calcule les cotisations CNSS salariales et patronales
3. Calcule l'IRPP avec le barème progressif (annualisé/12)
4. Calcule la CSS (1%)
5. Calcule le net à payer
6. Génère l'écriture comptable de paie
7. Prépare les données pour le bulletin de paie PDF
"""

# FONCTIONS REQUISES :

async def calculate_payslip(
    employee: dict,          # Données employé (salaire base, situation familiale, ancienneté...)
    month: int,              # Mois de paie (1-12)
    year: int,               # Année
    extras: dict = None      # Primes exceptionnelles, heures sup, absences, etc.
) -> dict:
    """
    Calcule un bulletin de paie complet.
    
    Retourne :
    {
        "employee_id": "...",
        "month": 6, "year": 2025,
        "gains": [
            {"code": "SAL_BASE", "name": "Salaire de base", "amount": 2500.000},
            {"code": "PRIM_TRANSPORT", "name": "Prime de transport", "amount": 100.000},
            ...
        ],
        "total_brut": 2600.000,
        "deductions": [
            {"code": "CNSS_SAL", "name": "CNSS salariale (9,18%)", "base": 2600.000, "amount": 238.680},
            {"code": "IRPP", "name": "Retenue IRPP", "base": 2125.320, "amount": 285.500},
            {"code": "CSS", "name": "CSS (1%)", "base": 2125.320, "amount": 21.253},
            ...
        ],
        "total_deductions": 545.433,
        "net_a_payer": 2054.567,
        "employer_charges": [
            {"code": "CNSS_PAT", "name": "CNSS patronale (16,57%)", "amount": 430.820},
            {"code": "TFP", "name": "TFP (2%)", "amount": 52.000},
            {"code": "FOPROLOS", "name": "FOPROLOS (1%)", "amount": 26.000},
        ],
        "total_employer_charges": 508.820,
        "cost_total_employer": 3108.820,  # Brut + charges patronales
    }
    """

def calculate_irpp_monthly(
    annual_taxable_income: float,
    family_deductions: float = 0
) -> float:
    """
    Calcule l'IRPP mensuel en appliquant le barème progressif annuel.
    
    Étapes :
    1. Annualiser le salaire imposable (× 12)
    2. Appliquer le barème progressif (tranches)
    3. Soustraire les déductions familiales annuelles
    4. Diviser par 12 pour obtenir la retenue mensuelle
    """

def calculate_seniority_bonus(
    base_salary: float,
    hire_date: str,      # Date d'embauche YYYY-MM-DD
    convention: str = "default"
) -> float:
    """
    Calcule la prime d'ancienneté selon les conventions collectives tunisiennes.
    """

async def generate_payroll_journal_entry(
    payslips: List[dict],    # Liste des bulletins du mois
    company_id: str,
    month: int, year: int
) -> dict:
    """
    Génère l'écriture comptable de paie mensuelle :
    
    Débit 6311 Salaires et appointements .......... TOTAL BRUT
    Débit 6341 Cotisations sécurité sociale ....... CNSS PATRONALE
    Débit 6358 TFP + FOPROLOS ..................... TFP + FOPROLOS
        Crédit 421 Personnel — Rémunérations dues ..... NET À PAYER
        Crédit 431 Sécurité sociale (CNSS) ............ CNSS SAL + PAT
        Crédit 4353 État — Retenues à la source ....... IRPP + CSS
        Crédit 4358 État — TFP + FOPROLOS ............. TFP + FOPROLOS
    """
```

---

## ÉTAPE 7 — Routes backend RH

### `backend/routes/hr_employees.py`

Routes CRUD pour les employés :
```
GET    /api/hr/employees                    → Liste des employés (avec filtres : actif/inactif, département, contrat)
POST   /api/hr/employees                    → Créer un employé
GET    /api/hr/employees/{id}               → Détail employé
PUT    /api/hr/employees/{id}               → Modifier un employé
DELETE /api/hr/employees/{id}               → Désactiver (soft delete)

POST   /api/hr/employees/{id}/contracts     → Ajouter un contrat
GET    /api/hr/employees/{id}/contracts     → Historique des contrats
PUT    /api/hr/contracts/{contract_id}      → Modifier un contrat
POST   /api/hr/contracts/{contract_id}/terminate → Fin de contrat (motif, date)

GET    /api/hr/contract-types               → Liste des types de contrats disponibles
GET    /api/hr/categories                   → Catégories professionnelles
GET    /api/hr/dashboard                    → Stats RH (effectifs, masse salariale, congés en cours...)
```

**Modèle employé MongoDB :**
```python
employee_doc = {
    "company_id": ObjectId,
    "matricule": "EMP-001",              # Numéro unique auto-généré
    "first_name": "Ahmed",
    "last_name": "Ben Ali",
    "cin": "12345678",                   # Carte d'identité nationale
    "date_of_birth": datetime,
    "gender": "M",                       # M/F
    "nationality": "tunisienne",
    "address": "...",
    "phone": "...",
    "email": "...",
    "bank_name": "BIAT",
    "rib": "...",                         # RIB pour virement salaire
    
    # Situation familiale (pour IRPP)
    "marital_status": "marie",            # celibataire/marie/divorce/veuf
    "children_count": 2,
    "children_details": [
        {"name": "...", "birth_date": "...", "handicapped": False, "student_no_scholarship": False}
    ],
    "dependents": {
        "spouse_no_income": True,
        "parents_dependent": 0,
    },
    
    # Emploi
    "department": "Commercial",
    "position": "Responsable commercial",
    "professional_category": "CAD2",      # Catégorie conventionnelle
    "hire_date": datetime,
    "seniority_date": datetime,           # Date d'ancienneté (peut différer de hire_date)
    "cnss_number": "...",                 # Numéro d'affiliation CNSS
    "status": "active",                   # active/inactive/terminated/on_leave
    
    # Rémunération
    "base_salary": 2500.000,              # Salaire de base mensuel
    "currency": "TND",
    "payment_method": "virement",         # virement/cheque/especes
    "work_regime": "48h",                 # 48h ou 40h
    "monthly_primes": [                   # Primes fixes mensuelles
        {"code": "PRIM_TRANSPORT", "name": "Prime de transport", "amount": 100},
        {"code": "PRIM_PRESENCE", "name": "Prime de présence", "amount": 50},
    ],
    
    # Congés
    "leave_balance": {
        "ANNUEL": {"acquired": 12, "taken": 5, "remaining": 7},
        "MALADIE": {"taken": 2},
        ...
    },
    
    # Contrat actif (référence)
    "current_contract_id": "...",
    
    "created_at": datetime,
    "updated_at": datetime,
    "created_by": ObjectId,
}
```

### `backend/routes/hr_payroll.py`

```
POST   /api/hr/payroll/calculate           → Calculer la paie d'un mois (preview, pas encore validé)
POST   /api/hr/payroll/validate            → Valider et enregistrer les bulletins du mois
GET    /api/hr/payroll/history              → Historique des paies (par mois)
GET    /api/hr/payroll/{payslip_id}        → Détail d'un bulletin
GET    /api/hr/payroll/{payslip_id}/pdf    → Télécharger le bulletin PDF
GET    /api/hr/payroll/mass-pdf/{month}/{year} → Télécharger tous les bulletins du mois (ZIP)

GET    /api/hr/payroll/config              → Configuration paie (taux CNSS, barème IRPP, etc.)
PUT    /api/hr/payroll/config              → Modifier la configuration (ex: taux accident travail)

GET    /api/hr/payroll/summary/{month}/{year} → Résumé mensuel (masse salariale, charges, etc.)
```

### `backend/routes/hr_leave.py`

```
GET    /api/hr/leaves                       → Liste des demandes de congé
POST   /api/hr/leaves                       → Soumettre une demande de congé
GET    /api/hr/leaves/{id}                  → Détail demande
PUT    /api/hr/leaves/{id}                  → Modifier une demande
POST   /api/hr/leaves/{id}/approve          → Approuver
POST   /api/hr/leaves/{id}/reject           → Refuser
DELETE /api/hr/leaves/{id}                  → Annuler

GET    /api/hr/leaves/balance/{employee_id} → Solde de congés d'un employé
GET    /api/hr/leaves/calendar              → Calendrier des congés (vue équipe)
GET    /api/hr/leave-types                  → Types de congés disponibles
```

### `backend/routes/hr_declarations.py`

```
POST   /api/hr/declarations/cnss/generate   → Générer la déclaration trimestrielle CNSS (DS7)
GET    /api/hr/declarations/cnss/history     → Historique des déclarations CNSS
GET    /api/hr/declarations/cnss/{id}/pdf    → Télécharger la déclaration CNSS en PDF

POST   /api/hr/declarations/irpp/generate    → Générer la déclaration mensuelle IRPP+TFP+FOPROLOS
GET    /api/hr/declarations/irpp/history     → Historique

POST   /api/hr/declarations/annual/generate  → Déclaration annuelle des salaires
GET    /api/hr/declarations/annual/{year}    → Récupérer la déclaration annuelle

POST   /api/hr/declarations/certificate/{employee_id}/{year} → Certificat de retenue à la source (PDF)
```

---

## ÉTAPE 8 — Frontend RH

### Menu sidebar — Ajouter dans `AppLayout.js` (après le groupe "Comptabilité") :

```javascript
{
  type: 'group',
  key: 'rh',
  icon: Users,    // ou UserCog
  label: 'Ressources Humaines',
  items: [
    { icon: PieChart, label: 'Tableau de bord RH', path: '/hr/dashboard' },
    { icon: Users, label: 'Employés', path: '/hr/employees' },
    { icon: FileText, label: 'Contrats', path: '/hr/contracts' },
    { icon: Calculator, label: 'Paie', path: '/hr/payroll' },
    { icon: Calendar, label: 'Congés', path: '/hr/leaves' },
    { icon: FileBarChart, label: 'Déclarations', path: '/hr/declarations' },
  ]
},
```

### Pages frontend à créer :

1. **HRDashboard.js** — Vue d'ensemble :
   - Nombre d'employés actifs / en congé / sortis
   - Masse salariale du mois
   - Répartition par département, catégorie, type de contrat
   - Congés en cours et à venir
   - Alertes (contrats arrivant à échéance, congés non pris, déclarations à faire)

2. **Employees.js** — Liste des employés :
   - Tableau avec filtres (département, statut, contrat)
   - Fiche employé détaillée (modal ou page)
   - Formulaire de création/édition complet
   - Onglets dans la fiche : Infos personnelles, Contrat, Rémunération, Congés, Bulletins

3. **Payroll.js** — Gestion de la paie :
   - Sélection du mois
   - Bouton "Calculer la paie" → preview de tous les bulletins
   - Tableau avec : Employé, Brut, CNSS, IRPP, CSS, Net
   - Bouton "Valider" → enregistre les bulletins
   - Bouton "Télécharger les bulletins" (PDF individuel ou ZIP)
   - Historique des mois validés

4. **LeaveManagement.js** — Congés :
   - Calendrier visuel des congés (vue mois)
   - Liste des demandes (en attente, approuvées, refusées)
   - Formulaire de demande de congé
   - Solde de congés par employé

5. **HRDeclarations.js** — Déclarations :
   - Sélection de la période
   - Génération CNSS trimestrielle (DS7)
   - Génération déclaration mensuelle IRPP/TFP/FOPROLOS
   - Historique des déclarations
   - Export PDF

---

## ÉTAPE 9 — Intégration comptable automatique (paie → écritures)

Quand un mois de paie est validé, créer automatiquement l'écriture comptable :

```
ÉCRITURE DE PAIE — Mois XX/YYYY

Débit :
  6311  Salaires et appointements .............. [TOTAL BRUT]
  6313  Primes et gratifications ............... [TOTAL PRIMES SI SÉPARÉ]
  6341  Cotisations sécurité sociale (patronale) [CNSS PATRONALE]
  6358  Autres impôts et taxes (TFP+FOPROLOS) .. [TFP + FOPROLOS]

Crédit :
  421   Personnel — Rémunérations dues ......... [TOTAL NET À PAYER]
  431   Sécurité sociale (CNSS sal+pat) ........ [CNSS SALARIALE + PATRONALE]
  4353  État — Retenues à la source (IRPP+CSS) . [IRPP + CSS]
  4358  État — Autres impôts (TFP+FOPROLOS) .... [TFP + FOPROLOS]
```

Et lors du paiement effectif des salaires (virement) :
```
Débit 421 Personnel — Rémunérations dues ...... [NET À PAYER]
  Crédit 521 Banques ........................... [NET À PAYER]
```

---

## ÉTAPE 10 — Routes dans `server.py`

Ajouter dans `server.py` :
```python
from routes import hr_employees, hr_payroll, hr_leave, hr_declarations

app.include_router(hr_employees.router)
app.include_router(hr_payroll.router)
app.include_router(hr_leave.router)
app.include_router(hr_declarations.router)
```

Et dans `App.js` (routes frontend) :
```jsx
<Route path="/hr/dashboard" element={<ProtectedRoute><HRDashboard /></ProtectedRoute>} />
<Route path="/hr/employees" element={<ProtectedRoute><Employees /></ProtectedRoute>} />
<Route path="/hr/employees/:id" element={<ProtectedRoute><EmployeeDetail /></ProtectedRoute>} />
<Route path="/hr/payroll" element={<ProtectedRoute><Payroll /></ProtectedRoute>} />
<Route path="/hr/leaves" element={<ProtectedRoute><LeaveManagement /></ProtectedRoute>} />
<Route path="/hr/declarations" element={<ProtectedRoute><HRDeclarations /></ProtectedRoute>} />
```

---

## CONTRAINTES TECHNIQUES MODULE RH

1. **Toutes les collections MongoDB** doivent inclure `company_id` pour le multi-tenant
2. **Les montants** sont en TND avec 3 décimales (millimes tunisiens) → `round(x, 3)`
3. **Le calcul IRPP** doit annualiser puis diviser par 12 (pas appliquer le barème au salaire mensuel directement)
4. **Les types de contrats** doivent être paramétrables (l'utilisateur peut en ajouter via les paramètres)
5. **La CNSS salariale** est toujours 9,18% du brut — le taux accident travail (0,5%-5%) est UNIQUEMENT patronal
6. **Les bulletins validés** ne peuvent PAS être modifiés (auditable)
7. **Le module doit fonctionner** même si aucun employé n'est créé (pas de crash sur listes vides)
8. **Les PDF** doivent utiliser le format standard tunisien de bulletin de paie
9. **Les déclarations CNSS** doivent suivre le format DS7 réglementaire

---

## RÉSUMÉ FINAL — TOUS LES CHANGEMENTS

| # | Fichier | Action | Module |
|---|---------|--------|--------|
| 1 | `backend/services/bank_ai_engine.py` | CRÉER | Bancaire |
| 2 | `backend/routes/bank_reconciliation.py` | MODIFIER | Bancaire |
| 3 | `frontend/src/pages/BankReconciliation.js` | MODIFIER | Bancaire |
| 4 | `backend/data/tunisian_hr_config.py` | CRÉER | RH |
| 5 | `backend/services/payroll_engine.py` | CRÉER | RH |
| 6 | `backend/services/hr_declarations_service.py` | CRÉER | RH |
| 7 | `backend/routes/hr_employees.py` | CRÉER | RH |
| 8 | `backend/routes/hr_payroll.py` | CRÉER | RH |
| 9 | `backend/routes/hr_leave.py` | CRÉER | RH |
| 10 | `backend/routes/hr_declarations.py` | CRÉER | RH |
| 11 | `backend/server.py` | MODIFIER | RH (ajouter routers) |
| 12 | `frontend/src/pages/HRDashboard.js` | CRÉER | RH |
| 13 | `frontend/src/pages/Employees.js` | CRÉER | RH |
| 14 | `frontend/src/pages/EmployeeDetail.js` | CRÉER | RH |
| 15 | `frontend/src/pages/Payroll.js` | CRÉER | RH |
| 16 | `frontend/src/pages/LeaveManagement.js` | CRÉER | RH |
| 17 | `frontend/src/pages/HRDeclarations.js` | CRÉER | RH |
| 18 | `frontend/src/App.js` | MODIFIER | RH (ajouter routes) |
| 19 | `frontend/src/components/layout/AppLayout.js` | MODIFIER | RH (sidebar menu) |

---

## TEST MODULE RH

1. **Employés** : Créer un employé CDI, vérifier tous les champs
2. **Contrat** : Ajouter un CDD, vérifier la date de fin et l'alerte de renouvellement
3. **Paie** : Calculer un bulletin pour un salarié à 2500 TND → vérifier CNSS (229,50), IRPP, CSS, net
4. **Congés** : Demander un congé annuel de 5 jours → vérifier le solde
5. **Déclaration CNSS** : Générer une DS7 trimestrielle → vérifier les totaux
6. **Intégration comptable** : Valider la paie → vérifier l'écriture 6311/421/431/4353
7. **PDF** : Télécharger un bulletin → vérifier le format et les calculs
