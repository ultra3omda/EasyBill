"""
Configuration des paramètres RH et paie conformes à la législation tunisienne.

Ce fichier contient toutes les constantes légales nécessaires au calcul de la paie,
des cotisations sociales (CNSS), de l'impôt sur le revenu (IRPP), des congés,
et des déclarations obligatoires en Tunisie.

Dernière mise à jour : Loi de Finances 2025
Références :
  - Code du Travail tunisien
  - Code de l'IRPP et de l'IS
  - Loi n° 60-30 relative à la CNSS
  - Loi de Finances 2024 et 2025
"""

# =============================================================================
# 1. TYPES DE CONTRATS DE TRAVAIL
# =============================================================================

CONTRACT_TYPES = [
    {
        "code": "CDI",
        "name": "Contrat à Durée Indéterminée",
        "description": "Contrat de travail sans limitation de durée, forme normale de la relation de travail",
        "cnss_applicable": True,
        "irpp_applicable": True,
        "leave_applicable": True,
        "max_duration": None,
        "regulations": "Articles 6 et suivants du Code du Travail"
    },
    {
        "code": "CDD",
        "name": "Contrat à Durée Déterminée",
        "description": "Contrat limité dans le temps, renouvelable dans les conditions prévues par la loi",
        "cnss_applicable": True,
        "irpp_applicable": True,
        "leave_applicable": True,
        "max_duration": 48,
        "regulations": "Articles 6-4 du Code du Travail"
    },
    {
        "code": "CIVP",
        "name": "Contrat d'Initiation à la Vie Professionnelle",
        "description": "Stage d'initiation pour les primo-demandeurs d'emploi diplômés du supérieur",
        "cnss_applicable": False,
        "irpp_applicable": False,
        "leave_applicable": False,
        "max_duration": 24,
        "regulations": "Loi n° 2009-21 du 28 avril 2009"
    },
    {
        "code": "CAIP",
        "name": "Contrat d'Adaptation et d'Insertion Professionnelle",
        "description": "Contrat pour l'adaptation des compétences des demandeurs d'emploi",
        "cnss_applicable": True,
        "irpp_applicable": True,
        "leave_applicable": True,
        "max_duration": 12,
        "regulations": "Décret n° 2012-2369"
    },
    {
        "code": "SIVP",
        "name": "Stage d'Initiation à la Vie Professionnelle",
        "description": "Stage pour les diplômés de l'enseignement supérieur sans expérience",
        "cnss_applicable": False,
        "irpp_applicable": False,
        "leave_applicable": False,
        "max_duration": 12,
        "regulations": "Loi n° 93-17 du 22 février 1993"
    },
    {
        "code": "CTT",
        "name": "Contrat de Travail Temporaire",
        "description": "Contrat pour une mission temporaire via une entreprise de travail temporaire",
        "cnss_applicable": True,
        "irpp_applicable": True,
        "leave_applicable": True,
        "max_duration": 4,
        "regulations": "Articles 29 et suivants du Code du Travail"
    },
    {
        "code": "TEMPS_PARTIEL",
        "name": "Contrat à Temps Partiel",
        "description": "Contrat avec une durée de travail inférieure à la durée légale",
        "cnss_applicable": True,
        "irpp_applicable": True,
        "leave_applicable": True,
        "max_duration": None,
        "regulations": "Article 94-2 du Code du Travail"
    },
    {
        "code": "SAISONNIER",
        "name": "Contrat Saisonnier",
        "description": "Contrat lié à une activité saisonnière récurrente",
        "cnss_applicable": True,
        "irpp_applicable": True,
        "leave_applicable": True,
        "max_duration": 6,
        "regulations": "Article 6-4 du Code du Travail"
    },
    {
        "code": "APPRENTISSAGE",
        "name": "Contrat d'Apprentissage",
        "description": "Contrat de formation alternée entre entreprise et centre de formation",
        "cnss_applicable": False,
        "irpp_applicable": False,
        "leave_applicable": True,
        "max_duration": 36,
        "regulations": "Loi n° 93-10 du 17 février 1993"
    },
    {
        "code": "STAGE_CONV",
        "name": "Convention de Stage",
        "description": "Stage conventionné dans le cadre d'une formation académique",
        "cnss_applicable": False,
        "irpp_applicable": False,
        "leave_applicable": False,
        "max_duration": 6,
        "regulations": "Circulaire du Ministère de la Formation Professionnelle"
    },
    {
        "code": "KARAMA",
        "name": "Contrat Karama",
        "description": "Programme d'emploi pour les diplômés du supérieur en chômage prolongé",
        "cnss_applicable": False,
        "irpp_applicable": False,
        "leave_applicable": False,
        "max_duration": 12,
        "regulations": "Programme Karama - Ministère de l'Emploi"
    },
]

# =============================================================================
# 2. BARÈME IRPP 2025
# =============================================================================

IRPP_BRACKETS_2025 = [
    {"min": 0, "max": 5000, "rate": 0},
    {"min": 5000, "max": 20000, "rate": 26},
    {"min": 20000, "max": 30000, "rate": 28},
    {"min": 30000, "max": 50000, "rate": 32},
    {"min": 50000, "max": None, "rate": 35},
]

# =============================================================================
# 3. CONTRIBUTION SOCIALE DE SOLIDARITÉ (CSS)
# =============================================================================

CSS_RATE = 1.0

# =============================================================================
# 4. DÉDUCTIONS POUR CHARGES DE FAMILLE
# =============================================================================

FAMILY_DEDUCTIONS = {
    "chef_de_famille": 300,
    "conjoint_sans_revenu": 260,
    "enfant_1": 100,
    "enfant_2": 100,
    "enfant_3": 100,
    "enfant_4": 100,
    "enfant_handicape": 2000,
    "parent_a_charge": 150,
    "etudiant_sans_bourse": 1000,
    "max_enfants": 4,
}

# =============================================================================
# 5. TAUX CNSS
# =============================================================================

CNSS_RATES = {
    "regime_general": {
        "employee_rate": 9.18,
        "employer_rate": 16.57,
        "total_rate": 25.75,
        "breakdown": {
            "vieillesse": {
                "employee": 4.74,
                "employer": 7.76,
            },
            "maladie": {
                "employee": 3.17,
                "employer": 5.08,
            },
            "familiales": {
                "employee": 0,
                "employer": 2.61,
            },
            "accident": {
                "employee": 0,
                "employer": 0.50,
            },
            "chomage": {
                "employee": 1.27,
                "employer": 0.62,
            },
        },
    },
}

# =============================================================================
# 6. TAUX ACCIDENT DU TRAVAIL PAR SECTEUR
# =============================================================================

CNSS_ACCIDENT_RATES_BY_SECTOR = {
    "services_administratifs": 0.5,
    "commerce": 0.5,
    "banques_assurances": 0.5,
    "hotellerie_restauration": 1.0,
    "textile_habillement": 1.5,
    "agroalimentaire": 2.0,
    "chimie_pharmacie": 2.0,
    "mecanique_metallurgie": 2.5,
    "btp": 3.0,
    "travaux_publics": 3.5,
    "mines_carrieres": 4.0,
    "electricite_gaz": 3.0,
    "transport_routier": 2.5,
    "transport_maritime": 3.0,
    "agriculture": 2.0,
    "peche": 3.5,
    "exploitation_forestiere": 4.0,
    "industrie_petroliere": 5.0,
}

# =============================================================================
# 7. TAXES SUR LA MASSE SALARIALE
# =============================================================================

PAYROLL_TAXES = {
    "TFP": {
        "name": "Taxe de Formation Professionnelle",
        "rates": {
            "industrie": 2,
            "autres": 1,
        },
        "base": "salaire_brut",
        "periodicite": "mensuelle",
    },
    "FOPROLOS": {
        "name": "Fonds de Promotion du Logement pour les Salariés",
        "rate": 1,
        "base": "salaire_brut",
        "periodicite": "mensuelle",
    },
}

# =============================================================================
# 8. SALAIRES MINIMUMS
# =============================================================================

MINIMUM_WAGES = {
    "SMIG_48H": {
        "name": "SMIG régime 48h/semaine",
        "monthly": 472.368,
        "hourly": 2.271,
    },
    "SMIG_40H": {
        "name": "SMIG régime 40h/semaine",
        "monthly": 407.944,
        "hourly": 2.353,
    },
    "SMAG": {
        "name": "Salaire Minimum Agricole Garanti",
        "daily": 16.856,
    },
}

# =============================================================================
# 9. TYPES DE CONGÉS
# =============================================================================

LEAVE_TYPES = [
    {
        "code": "ANNUEL",
        "name": "Congé annuel payé",
        "default_days": 12,
        "paid": True,
        "unit": "jours_ouvrables",
        "regulations": "Article 112 du Code du Travail",
        "notes": "1 jour par mois de service effectif, minimum 12 jours ouvrables par an",
    },
    {
        "code": "MALADIE",
        "name": "Congé de maladie",
        "default_days": None,
        "paid": True,
        "unit": "jours_calendaires",
        "regulations": "Articles 131 et suivants du Code du Travail",
        "notes": "Durée selon certificat médical. Indemnités CNSS après 5 jours de carence",
    },
    {
        "code": "MATERNITE",
        "name": "Congé de maternité",
        "default_days": 60,
        "paid": True,
        "unit": "jours_calendaires",
        "regulations": "Article 64 du Code du Travail",
        "notes": "30 jours avant et 30 jours après l'accouchement",
    },
    {
        "code": "PATERNITE",
        "name": "Congé de paternité",
        "default_days": 2,
        "paid": True,
        "unit": "jours_ouvrables",
        "regulations": "Article 47-8 du Code du Travail",
        "notes": "À l'occasion de la naissance d'un enfant",
    },
    {
        "code": "MARIAGE",
        "name": "Congé de mariage",
        "default_days": 3,
        "paid": True,
        "unit": "jours_ouvrables",
        "regulations": "Conventions collectives",
        "notes": "Mariage du salarié",
    },
    {
        "code": "MARIAGE_ENFANT",
        "name": "Congé mariage d'un enfant",
        "default_days": 1,
        "paid": True,
        "unit": "jours_ouvrables",
        "regulations": "Conventions collectives",
        "notes": "À l'occasion du mariage d'un enfant du salarié",
    },
    {
        "code": "DECES_CONJOINT",
        "name": "Congé décès du conjoint",
        "default_days": 3,
        "paid": True,
        "unit": "jours_ouvrables",
        "regulations": "Conventions collectives",
        "notes": "Décès du conjoint du salarié",
    },
    {
        "code": "DECES_PARENT",
        "name": "Congé décès d'un parent",
        "default_days": 3,
        "paid": True,
        "unit": "jours_ouvrables",
        "regulations": "Conventions collectives",
        "notes": "Décès du père, de la mère ou d'un enfant du salarié",
    },
    {
        "code": "NAISSANCE",
        "name": "Congé de naissance",
        "default_days": 2,
        "paid": True,
        "unit": "jours_ouvrables",
        "regulations": "Conventions collectives",
        "notes": "À l'occasion de la naissance d'un enfant",
    },
    {
        "code": "CIRCONCISION",
        "name": "Congé de circoncision",
        "default_days": 1,
        "paid": True,
        "unit": "jours_ouvrables",
        "regulations": "Conventions collectives",
        "notes": "Circoncision d'un fils du salarié",
    },
    {
        "code": "PELERINAGE",
        "name": "Congé de pèlerinage",
        "default_days": 30,
        "paid": False,
        "unit": "jours_calendaires",
        "regulations": "Article 116 du Code du Travail",
        "notes": "Pèlerinage aux Lieux Saints, une seule fois durant la carrière",
    },
    {
        "code": "SANS_SOLDE",
        "name": "Congé sans solde",
        "default_days": None,
        "paid": False,
        "unit": "jours_calendaires",
        "regulations": "Accord entre employeur et salarié",
        "notes": "Durée convenue entre les parties",
    },
    {
        "code": "FORMATION",
        "name": "Congé de formation",
        "default_days": 10,
        "paid": True,
        "unit": "jours_ouvrables",
        "regulations": "Article 116 du Code du Travail",
        "notes": "Pour formation professionnelle continue",
    },
    {
        "code": "SYNDICAL",
        "name": "Congé syndical",
        "default_days": 6,
        "paid": True,
        "unit": "jours_ouvrables",
        "regulations": "Code du Travail - Liberté syndicale",
        "notes": "Pour activités syndicales, sur justificatif",
    },
    {
        "code": "ALLAITEMENT",
        "name": "Repos d'allaitement",
        "default_days": None,
        "paid": True,
        "unit": "heures_par_jour",
        "regulations": "Article 64 du Code du Travail",
        "notes": "Deux repos d'une demi-heure chacun pendant 9 mois après l'accouchement",
    },
]

# =============================================================================
# 10. JOURS FÉRIÉS
# =============================================================================

PUBLIC_HOLIDAYS = {
    "fixed": [
        {"date": "01-01", "name": "Jour de l'An"},
        {"date": "01-14", "name": "Fête de la Révolution et de la Jeunesse"},
        {"date": "03-20", "name": "Fête de l'Indépendance"},
        {"date": "04-09", "name": "Journée des Martyrs"},
        {"date": "05-01", "name": "Fête du Travail"},
        {"date": "07-25", "name": "Fête de la République"},
        {"date": "08-13", "name": "Journée de la Femme"},
        {"date": "10-15", "name": "Fête de l'Évacuation"},
    ],
    "variable": [
        {
            "code": "AID_FITR",
            "name": "Aïd El Fitr",
            "days": 2,
            "notes": "Dates variables selon le calendrier hégirien",
        },
        {
            "code": "AID_IDHA",
            "name": "Aïd El Idha",
            "days": 2,
            "notes": "Dates variables selon le calendrier hégirien",
        },
        {
            "code": "RAS_EL_AM",
            "name": "Ras El Am El Hijri (Nouvel An hégirien)",
            "days": 1,
            "notes": "Date variable selon le calendrier hégirien",
        },
        {
            "code": "MOULED",
            "name": "Mouled (Anniversaire du Prophète)",
            "days": 1,
            "notes": "Date variable selon le calendrier hégirien",
        },
    ],
}

# =============================================================================
# 11. RUBRIQUES DE PAIE
# =============================================================================

PAYROLL_RUBRICS = {
    "gains": {
        "SAL_BASE": {
            "name": "Salaire de base",
            "type": "fixe",
            "cnss_applicable": True,
            "irpp_applicable": True,
        },
        "PRIM_ANCIENNETE": {
            "name": "Prime d'ancienneté",
            "type": "variable",
            "cnss_applicable": True,
            "irpp_applicable": True,
        },
        "PRIM_TRANSPORT": {
            "name": "Prime de transport",
            "type": "fixe",
            "cnss_applicable": False,
            "irpp_applicable": True,
        },
        "PRIM_PRESENCE": {
            "name": "Prime de présence",
            "type": "variable",
            "cnss_applicable": True,
            "irpp_applicable": True,
        },
        "PRIM_RENDEMENT": {
            "name": "Prime de rendement",
            "type": "variable",
            "cnss_applicable": True,
            "irpp_applicable": True,
        },
        "PRIM_RISQUE": {
            "name": "Prime de risque",
            "type": "fixe",
            "cnss_applicable": True,
            "irpp_applicable": True,
        },
        "PRIM_SALISSURE": {
            "name": "Prime de salissure",
            "type": "fixe",
            "cnss_applicable": True,
            "irpp_applicable": True,
        },
        "PRIM_PANIER": {
            "name": "Prime de panier",
            "type": "fixe",
            "cnss_applicable": False,
            "irpp_applicable": True,
        },
        "PRIM_CAISSE": {
            "name": "Prime de caisse",
            "type": "fixe",
            "cnss_applicable": True,
            "irpp_applicable": True,
        },
        "PRIM_RESPONSABILITE": {
            "name": "Prime de responsabilité",
            "type": "fixe",
            "cnss_applicable": True,
            "irpp_applicable": True,
        },
        "PRIM_TECHNICITE": {
            "name": "Prime de technicité",
            "type": "fixe",
            "cnss_applicable": True,
            "irpp_applicable": True,
        },
        "HEURES_SUP_25": {
            "name": "Heures supplémentaires à 25%",
            "type": "variable",
            "cnss_applicable": True,
            "irpp_applicable": True,
        },
        "HEURES_SUP_50": {
            "name": "Heures supplémentaires à 50%",
            "type": "variable",
            "cnss_applicable": True,
            "irpp_applicable": True,
        },
        "HEURES_SUP_75": {
            "name": "Heures supplémentaires à 75%",
            "type": "variable",
            "cnss_applicable": True,
            "irpp_applicable": True,
        },
        "HEURES_SUP_100": {
            "name": "Heures supplémentaires à 100%",
            "type": "variable",
            "cnss_applicable": True,
            "irpp_applicable": True,
        },
        "GRATIFICATION": {
            "name": "Gratification",
            "type": "variable",
            "cnss_applicable": True,
            "irpp_applicable": True,
        },
        "TREIZIEME_MOIS": {
            "name": "13ème mois",
            "type": "annuelle",
            "cnss_applicable": True,
            "irpp_applicable": True,
        },
        "CONGE_PAYE": {
            "name": "Indemnité de congé payé",
            "type": "variable",
            "cnss_applicable": True,
            "irpp_applicable": True,
        },
        "AVANTAGE_NATURE": {
            "name": "Avantage en nature",
            "type": "fixe",
            "cnss_applicable": True,
            "irpp_applicable": True,
        },
    },
    "deductions": {
        "CNSS_SAL": {
            "name": "Cotisation CNSS salariale",
            "rate": 9.18,
            "base": "salaire_brut_cnss",
        },
        "IRPP": {
            "name": "Impôt sur le Revenu des Personnes Physiques",
            "rate": None,
            "base": "revenu_net_imposable",
        },
        "CSS": {
            "name": "Contribution Sociale de Solidarité",
            "rate": 1.0,
            "base": "revenu_net_imposable",
        },
        "AVANCE_SALAIRE": {
            "name": "Avance sur salaire",
            "rate": None,
            "base": None,
        },
        "PRET": {
            "name": "Remboursement prêt",
            "rate": None,
            "base": None,
        },
        "ABSENCE": {
            "name": "Retenue pour absence",
            "rate": None,
            "base": "salaire_journalier",
        },
        "CESSION": {
            "name": "Cession sur salaire",
            "rate": None,
            "base": None,
        },
        "MUTUELLE": {
            "name": "Cotisation mutuelle complémentaire",
            "rate": None,
            "base": None,
        },
        "SYNDICAT": {
            "name": "Cotisation syndicale",
            "rate": None,
            "base": None,
        },
    },
    "employer_charges": {
        "CNSS_PAT": {
            "name": "Cotisation CNSS patronale",
            "rate": 16.57,
            "base": "salaire_brut_cnss",
        },
        "TFP": {
            "name": "Taxe de Formation Professionnelle",
            "rate": None,
            "base": "salaire_brut",
        },
        "FOPROLOS": {
            "name": "FOPROLOS",
            "rate": 1.0,
            "base": "salaire_brut",
        },
    },
}

# =============================================================================
# 12. CONVENTIONS COLLECTIVES TUNISIENNES (profils sectoriels de départ)
# =============================================================================

DEFAULT_TUNISIAN_CONVENTION_CODE = "services_administratifs"

TUNISIAN_COLLECTIVE_CONVENTIONS = {
    "services_administratifs": {
        "code": "services_administratifs",
        "name": "Services administratifs et tertiaire",
        "country": "TN",
        "accident_sector": "services_administratifs",
        "tfp_category": "autres",
        "notes": "Profil générique tertiaire. Les primes minimales peuvent être ajustées par société.",
        "mandatory_primes": [],
        "source": "Paramétrage RH interne EasyBill",
    },
    "commerce_gros_detail": {
        "code": "commerce_gros_detail",
        "name": "Commerce de gros, demi-gros et détail",
        "country": "TN",
        "accident_sector": "commerce",
        "tfp_category": "autres",
        "notes": "Prime transport et présence issues de la convention collective sectorielle.",
        "mandatory_primes": [
            {
                "code": "PRIM_TRANSPORT",
                "name": "Prime de transport",
                "amounts_by_category": {
                    "default": 75.012,
                    "cadre": 82.746,
                    "cadre_superieur": 82.746,
                },
                "calculation": "fixed_monthly_by_category",
                "cnss_applicable": False,
                "irpp_applicable": True,
                "editable": True,
                "source": "Convention collective commerce 2024",
            },
            {
                "code": "PRIM_PRESENCE",
                "name": "Prime de présence",
                "amount": 14.130,
                "calculation": "fixed_monthly",
                "cnss_applicable": True,
                "irpp_applicable": True,
                "editable": True,
                "source": "Convention collective commerce 2024",
            },
        ],
        "source": "Convention collective commerce 2024",
    },
    "btp": {
        "code": "btp",
        "name": "Bâtiment et travaux publics",
        "country": "TN",
        "accident_sector": "btp",
        "tfp_category": "industrie",
        "notes": "Prime panier calculée sur une base mensuelle de 26 jours ouvrés.",
        "mandatory_primes": [
            {
                "code": "PRIM_PANIER",
                "name": "Prime de panier",
                "amount": 20.800,
                "calculation": "fixed_monthly",
                "cnss_applicable": False,
                "irpp_applicable": True,
                "editable": True,
                "source": "Convention collective BTP (0,800 TND/jour x 26 jours)",
            },
        ],
        "source": "Convention collective BTP",
    },
    "industrie_generique": {
        "code": "industrie_generique",
        "name": "Industrie (profil générique)",
        "country": "TN",
        "accident_sector": "mecanique_metallurgie",
        "tfp_category": "industrie",
        "notes": "Profil industriel générique. Compléter les primes selon la convention d'entreprise.",
        "mandatory_primes": [],
        "source": "Paramétrage RH interne EasyBill",
    },
}

# =============================================================================
# 12. CATÉGORIES PROFESSIONNELLES
# =============================================================================

PROFESSIONAL_CATEGORIES = [
    {"code": "OS1", "name": "Ouvrier Spécialisé 1", "level": 1},
    {"code": "OS2", "name": "Ouvrier Spécialisé 2", "level": 2},
    {"code": "OP1", "name": "Ouvrier Professionnel 1", "level": 3},
    {"code": "OP2", "name": "Ouvrier Professionnel 2", "level": 4},
    {"code": "OP3", "name": "Ouvrier Professionnel 3", "level": 5},
    {"code": "CE1", "name": "Chef d'Équipe 1", "level": 6},
    {"code": "CE2", "name": "Chef d'Équipe 2", "level": 7},
    {"code": "EM1", "name": "Employé 1", "level": 8},
    {"code": "EM2", "name": "Employé 2", "level": 9},
    {"code": "AM1", "name": "Agent de Maîtrise 1", "level": 10},
    {"code": "AM2", "name": "Agent de Maîtrise 2", "level": 11},
    {"code": "CAD1", "name": "Cadre 1", "level": 12},
    {"code": "CAD2", "name": "Cadre 2", "level": 13},
    {"code": "CADSUP", "name": "Cadre Supérieur", "level": 14},
    {"code": "DIR", "name": "Directeur", "level": 15},
]

# =============================================================================
# 13. DÉCLARATIONS OBLIGATOIRES
# =============================================================================

MANDATORY_DECLARATIONS = [
    {
        "code": "CNSS_TRIM",
        "name": "Déclaration trimestrielle CNSS",
        "frequency": "trimestrielle",
        "deadline": "15 du mois suivant la fin du trimestre",
        "authority": "CNSS",
        "description": "Déclaration des salaires et cotisations sociales",
    },
    {
        "code": "IRPP_MENSUEL",
        "name": "Retenue à la source mensuelle IRPP",
        "frequency": "mensuelle",
        "deadline": "15 du mois suivant",
        "authority": "Recette des Finances",
        "description": "Versement des retenues IRPP et CSS prélevées sur les salaires",
    },
    {
        "code": "DECLARATION_ANNUELLE",
        "name": "Déclaration annuelle de l'employeur",
        "frequency": "annuelle",
        "deadline": "28 février de l'année suivante",
        "authority": "Bureau de Contrôle des Impôts",
        "description": "Récapitulatif annuel des salaires versés et retenues opérées",
    },
    {
        "code": "CERTIFICAT_RETENUE",
        "name": "Certificat de retenue à la source",
        "frequency": "annuelle",
        "deadline": "28 février de l'année suivante",
        "authority": "Remis au salarié",
        "description": "Certificat individuel de retenue d'impôt pour chaque salarié",
    },
    {
        "code": "TFP_MENSUEL",
        "name": "Déclaration TFP mensuelle",
        "frequency": "mensuelle",
        "deadline": "15 du mois suivant",
        "authority": "Recette des Finances",
        "description": "Versement de la Taxe de Formation Professionnelle",
    },
    {
        "code": "FOPROLOS_MENSUEL",
        "name": "Déclaration FOPROLOS mensuelle",
        "frequency": "mensuelle",
        "deadline": "15 du mois suivant",
        "authority": "Recette des Finances",
        "description": "Versement de la contribution FOPROLOS",
    },
]

# =============================================================================
# 14. DÉDUCTION POUR FRAIS PROFESSIONNELS
# =============================================================================

PROFESSIONAL_EXPENSES_DEDUCTION = {
    "rate": 10,
    "annual_cap": 2000,
    "monthly_cap": 166.667,
}

# =============================================================================
# 15. PRESETS LOI DE FINANCES
# =============================================================================

FINANCE_LAW_PRESETS = {
    "LF_2024": {
        "name": "Loi de Finances 2024",
        "irpp_brackets": [
            {"min": 0, "max": 5000, "rate": 0},
            {"min": 5000, "max": 20000, "rate": 26},
            {"min": 20000, "max": 30000, "rate": 28},
            {"min": 30000, "max": 50000, "rate": 32},
            {"min": 50000, "max": None, "rate": 35},
        ],
        "css_rate": 1.0,
        "cnss_employee_rate": 9.18,
        "cnss_employer_rate": 16.57,
        "tfp_rate_industrie": 2,
        "tfp_rate_autres": 1,
        "foprolos_rate": 1,
        "professional_expenses_rate": 10,
        "professional_expenses_cap": 2000,
        "family_deductions": {
            "chef_de_famille": 300,
            "conjoint_sans_revenu": 260,
            "enfant": 100,
            "enfant_handicape": 2000,
            "parent_a_charge": 150,
            "etudiant_sans_bourse": 1000,
        },
    },
    "LF_2025": {
        "name": "Loi de Finances 2025",
        "irpp_brackets": [
            {"min": 0, "max": 5000, "rate": 0},
            {"min": 5000, "max": 20000, "rate": 26},
            {"min": 20000, "max": 30000, "rate": 28},
            {"min": 30000, "max": 50000, "rate": 32},
            {"min": 50000, "max": None, "rate": 35},
        ],
        "css_rate": 1.0,
        "cnss_employee_rate": 9.18,
        "cnss_employer_rate": 16.57,
        "tfp_rate_industrie": 2,
        "tfp_rate_autres": 1,
        "foprolos_rate": 1,
        "professional_expenses_rate": 10,
        "professional_expenses_cap": 2000,
        "family_deductions": {
            "chef_de_famille": 300,
            "conjoint_sans_revenu": 260,
            "enfant": 100,
            "enfant_handicape": 2000,
            "parent_a_charge": 150,
            "etudiant_sans_bourse": 1000,
        },
    },
}


# =============================================================================
# 16. DEFAULT_HR_CONFIG — Configuration agrégée pour initialisation MongoDB
# =============================================================================

DEFAULT_HR_CONFIG = {
    "irpp_config": {
        "brackets": IRPP_BRACKETS_2025,
        "css_rate": CSS_RATE,
        "css_active": True,
        "professional_expenses": PROFESSIONAL_EXPENSES_DEDUCTION,
        "family_deductions": FAMILY_DEDUCTIONS,
        "effective_date": "2025-01-01",
        "source": "Loi de Finances 2025",
    },
    "cnss_config": {
        "regime": "general",
        "employee_rate": CNSS_RATES["regime_general"]["employee_rate"],
        "employer_rate": CNSS_RATES["regime_general"]["employer_rate"],
        "total_rate": CNSS_RATES["regime_general"]["total_rate"],
        "breakdown": CNSS_RATES["regime_general"].get("breakdown", {}),
        "plafond_mensuel": None,
        "effective_date": "2025-01-01",
    },
    "parafiscal_config": {
        "tfp": {
            "active": True,
            "rate": PAYROLL_TAXES["TFP"]["rates"]["industrie"],
            "rate_industrie": PAYROLL_TAXES["TFP"]["rates"]["industrie"],
            "rate_autres": PAYROLL_TAXES["TFP"]["rates"]["autres"],
            "base": "salaire_brut",
        },
        "foprolos": {
            "active": True,
            "rate": PAYROLL_TAXES["FOPROLOS"]["rate"],
            "base": "salaire_brut",
        },
        "contribution_conjoncturelle": {
            "active": False,
            "rate": 0,
        },
    },
    "minimum_wages": {
        "smig_48h_monthly": MINIMUM_WAGES["SMIG_48H"]["monthly"],
        "smig_40h_monthly": MINIMUM_WAGES["SMIG_40H"]["monthly"],
        "smig_48h_hourly": MINIMUM_WAGES["SMIG_48H"]["hourly"],
        "smig_40h_hourly": MINIMUM_WAGES["SMIG_40H"]["hourly"],
        "smag_daily": MINIMUM_WAGES["SMAG"]["daily"],
        "enforce_minimum": True,
    },
    "convention_collective_code": DEFAULT_TUNISIAN_CONVENTION_CODE,
    "payroll_convention_profile": TUNISIAN_COLLECTIVE_CONVENTIONS[DEFAULT_TUNISIAN_CONVENTION_CODE],
    "contract_types_config": {
        ct["code"]: {"active": True, "customizable": ct["code"] not in ("CDI", "CDD"), "order": i + 1}
        for i, ct in enumerate(CONTRACT_TYPES)
    },
    "payroll_rubrics_config": {
        "gains": {
            code: {
                "active": code in ("SAL_BASE", "PRIM_ANCIENNETE", "PRIM_RENDEMENT", "PRIM_TRANSPORT", "PRIM_PANIER", "PRIM_PRESENCE", "HEURES_SUP_25", "HEURES_SUP_50", "HEURES_SUP_75", "HEURES_SUP_100", "CONGE_PAYE"),
                "mandatory": code in ("SAL_BASE", "CONGE_PAYE"),
                "editable": code not in ("SAL_BASE", "CONGE_PAYE"),
            }
            for code in PAYROLL_RUBRICS["gains"]
        },
        "deductions": {
            code: {
                "active": code in ("CNSS_SAL", "IRPP", "CSS", "AVANCE_SALAIRE", "PRET"),
                "mandatory": code in ("CNSS_SAL", "IRPP", "CSS"),
                "editable": code not in ("CNSS_SAL", "IRPP", "CSS"),
            }
            for code in PAYROLL_RUBRICS["deductions"]
        },
        "custom_gains": [],
        "custom_deductions": [],
    },
    "leave_types_config": {
        lt["code"]: {
            "active": True,
            "days": lt.get("base_days", lt.get("duration_days", lt.get("max_days_per_year"))),
            "paid": lt.get("paid", False),
            "editable_days": lt["code"] not in ("MALADIE", "SANS_SOLDE", "ALLAITEMENT"),
        }
        for lt in LEAVE_TYPES
    },
    "accounting_config": {
        "journal_code": "PA",
        "journal_label": "Journal de Paie",
        "auto_generate_entries": True,
        "grouping": "global",
        "accounts": {
            "salaires_bruts": {"code": "6311", "label": "Salaires et appointements"},
            "primes_gratifications": {"code": "6313", "label": "Primes et gratifications"},
            "heures_supplementaires": {"code": "6312", "label": "Heures supplémentaires"},
            "cnss_patronale": {"code": "6341", "label": "Cotisations sécurité sociale (patronale)"},
            "tfp_foprolos": {"code": "6358", "label": "TFP + FOPROLOS"},
            "net_a_payer": {"code": "421", "label": "Personnel — Rémunérations dues"},
            "cnss_a_payer": {"code": "431", "label": "Sécurité sociale (CNSS)"},
            "irpp_css": {"code": "4353", "label": "État — Retenues à la source (IRPP + CSS)"},
            "tfp_foprolos_a_payer": {"code": "4358", "label": "État — TFP + FOPROLOS"},
            "avances_personnel": {"code": "4251", "label": "Avances sur salaires"},
            "banque_virement": {"code": "521", "label": "Banques"},
        },
    },
    "declarations_config": {
        "cnss_quarterly": True,
        "irpp_monthly": True,
        "annual_declaration": True,
        "auto_reminder_days_before": 5,
        "company_cnss_number": "",
        "company_tax_id": "",
        "declaration_format": "standard",
    },
}
