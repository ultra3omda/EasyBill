from copy import deepcopy

from data.tunisian_chart_of_accounts import TUNISIAN_CHART_OF_ACCOUNTS


TUNISIA_SEMANTIC_BY_CODE = {
    "411": "customer_receivable",
    "401": "supplier_payable",
    "521": "bank",
    "531": "cash",
    "471": "suspense",
    "4711": "suspense",
    "606": "purchases",
    "6061": "utilities",
    "6068": "fuel",
    "615": "repairs",
    "6155": "repairs",
    "623": "marketing",
    "6231": "marketing",
    "625": "travel",
    "6251": "travel",
    "626": "telecom",
    "6262": "telecom",
    "6264": "telecom",
    "627": "bank_fee",
    "6278": "bank_fee",
    "641": "salaries",
    "421": "employee_payable",
    "431": "social_charges",
    "4351": "vat_collectible",
    "4362": "vat_deductible",
    "706": "revenue_services",
    "707": "revenue_goods",
}


def build_tunisia_chart_template():
    accounts = []
    for account in deepcopy(TUNISIAN_CHART_OF_ACCOUNTS):
        code = account["code"]
        semantic_key = TUNISIA_SEMANTIC_BY_CODE.get(code)
        accounts.append(
            {
                **account,
                "country_code": "TN",
                "code_system": "SCE_TN",
                "semantic_key": semantic_key,
                "is_system_default": True,
                "is_user_editable": account.get("is_group", False) is False,
                "protected": bool(semantic_key),
                "metadata": {
                    "template": "tunisia_default",
                    "legacy_seed": True,
                },
            }
        )
    return accounts
