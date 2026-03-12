import copy
from typing import Dict, List, Optional

from data.tunisian_hr_config import (
    DEFAULT_TUNISIAN_CONVENTION_CODE,
    TUNISIAN_COLLECTIVE_CONVENTIONS,
)


def list_tunisian_conventions() -> List[Dict]:
    return [copy.deepcopy(profile) for profile in TUNISIAN_COLLECTIVE_CONVENTIONS.values()]


def get_convention_profile(
    code: Optional[str] = None,
    custom_profile: Optional[Dict] = None,
) -> Dict:
    selected_code = code or DEFAULT_TUNISIAN_CONVENTION_CODE
    base_profile = copy.deepcopy(
        TUNISIAN_COLLECTIVE_CONVENTIONS.get(
            selected_code,
            TUNISIAN_COLLECTIVE_CONVENTIONS[DEFAULT_TUNISIAN_CONVENTION_CODE],
        )
    )
    if not custom_profile:
        return base_profile

    merged = copy.deepcopy(base_profile)
    for key, value in custom_profile.items():
        if key == "mandatory_primes" and isinstance(value, list):
            merged[key] = copy.deepcopy(value)
        elif value is not None:
            merged[key] = copy.deepcopy(value)
    return merged


def resolve_convention_for_config(config: Optional[Dict]) -> Dict:
    config = config or {}
    return get_convention_profile(
        config.get("convention_collective_code"),
        config.get("payroll_convention_profile"),
    )


def get_prime_amount_for_employee(prime_rule: Dict, employee: Optional[Dict]) -> float:
    employee = employee or {}
    category = employee.get("professional_category") or employee.get("category")
    amount = prime_rule.get("amount")
    if amount is not None:
        return round(float(amount), 3)

    amounts_by_category = prime_rule.get("amounts_by_category") or {}
    if category and category in amounts_by_category:
        return round(float(amounts_by_category[category]), 3)
    if "default" in amounts_by_category:
        return round(float(amounts_by_category["default"]), 3)
    return 0.0


def get_mandatory_primes_for_employee(employee: Optional[Dict], convention_profile: Dict) -> List[Dict]:
    primes = []
    for prime_rule in convention_profile.get("mandatory_primes", []):
        amount = get_prime_amount_for_employee(prime_rule, employee)
        if amount <= 0:
            continue
        primes.append({
            "code": prime_rule.get("code", ""),
            "name": prime_rule.get("name", prime_rule.get("code", "")),
            "amount": amount,
            "is_mandatory": True,
            "editable": bool(prime_rule.get("editable", True)),
            "source": prime_rule.get("source") or convention_profile.get("source"),
            "calculation": prime_rule.get("calculation", "fixed_monthly"),
            "cnss_applicable": bool(prime_rule.get("cnss_applicable", True)),
            "irpp_applicable": bool(prime_rule.get("irpp_applicable", True)),
        })
    return primes

