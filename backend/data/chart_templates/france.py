FRANCE_CHART_TEMPLATE = [
    {"code": "401", "name": "Fournisseurs", "type": "liability", "semantic_key": "supplier_payable"},
    {"code": "411", "name": "Clients", "type": "asset", "semantic_key": "customer_receivable"},
    {"code": "44566", "name": "TVA déductible sur autres biens et services", "type": "asset", "semantic_key": "vat_deductible"},
    {"code": "44571", "name": "TVA collectée", "type": "liability", "semantic_key": "vat_collectible"},
    {"code": "512", "name": "Banques", "type": "asset", "semantic_key": "bank"},
    {"code": "471", "name": "Compte d'attente", "type": "asset", "semantic_key": "suspense"},
    {"code": "531", "name": "Caisse", "type": "asset", "semantic_key": "cash"},
    {"code": "606", "name": "Achats non stockés de matières et fournitures", "type": "expense", "semantic_key": "purchases"},
    {"code": "615", "name": "Entretien et réparations", "type": "expense", "semantic_key": "repairs"},
    {"code": "623", "name": "Publicité, publications, relations publiques", "type": "expense", "semantic_key": "marketing"},
    {"code": "625", "name": "Déplacements, missions et réceptions", "type": "expense", "semantic_key": "travel"},
    {"code": "626", "name": "Frais postaux et télécommunications", "type": "expense", "semantic_key": "telecom"},
    {"code": "627", "name": "Services bancaires et assimilés", "type": "expense", "semantic_key": "bank_fee"},
    {"code": "641", "name": "Rémunérations du personnel", "type": "expense", "semantic_key": "salaries"},
    {"code": "421", "name": "Personnel - rémunérations dues", "type": "liability", "semantic_key": "employee_payable"},
    {"code": "431", "name": "Sécurité sociale", "type": "liability", "semantic_key": "social_charges"},
    {"code": "706", "name": "Prestations de services", "type": "income", "semantic_key": "revenue_services"},
    {"code": "707", "name": "Ventes de marchandises", "type": "income", "semantic_key": "revenue_goods"},
]


def build_france_chart_template():
    return [
        {
            **account,
            "country_code": "FR",
            "code_system": "PCG_FR",
            "is_group": False,
            "parent_code": account["code"][0] if len(account["code"]) > 1 else None,
            "is_system_default": True,
            "is_user_editable": True,
            "protected": True,
            "metadata": {
                "template": "france_default",
            },
        }
        for account in FRANCE_CHART_TEMPLATE
    ]
