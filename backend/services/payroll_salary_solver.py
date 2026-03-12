from datetime import date, datetime
from typing import Dict, List, Optional

from data.tunisian_hr_config import CNSS_ACCIDENT_RATES_BY_SECTOR, CNSS_RATES, DEFAULT_HR_CONFIG
from services.payroll_convention_service import (
    get_mandatory_primes_for_employee,
    resolve_convention_for_config,
)


def round3(value: float) -> float:
    return round(float(value or 0), 3)


def parse_number(value) -> float:
    try:
        return round3(float(value or 0))
    except (TypeError, ValueError):
        return 0.0


def calculate_irpp_monthly(monthly_taxable_income: float, family_deductions_annual: float = 0) -> float:
    if monthly_taxable_income <= 0:
        return 0.0

    annual_taxable = monthly_taxable_income * 12
    brackets = DEFAULT_HR_CONFIG["irpp_config"]["brackets"]
    annual_irpp = 0.0

    for bracket in brackets:
        bracket_min = bracket["min"]
        bracket_max = bracket["max"]
        rate = bracket["rate"]

        if annual_taxable <= bracket_min:
            break

        taxable_in_bracket = annual_taxable - bracket_min if bracket_max is None else min(annual_taxable, bracket_max) - bracket_min
        if taxable_in_bracket > 0:
            annual_irpp += taxable_in_bracket * rate / 100

    annual_irpp = max(0.0, annual_irpp - family_deductions_annual)
    return round3(annual_irpp / 12)


def calculate_family_deductions(employee: Optional[Dict], config: Dict) -> float:
    employee = employee or {}
    family_cfg = config.get("irpp_config", {}).get("family_deductions", {})
    deductions = 0.0

    marital_status = (employee.get("marital_status") or "").lower()
    children_count = int(employee.get("children_count") or 0)

    if marital_status in {"marie", "married"}:
        deductions += family_cfg.get("chef_de_famille", 0)
        if employee.get("spouse_dependent", False):
            deductions += family_cfg.get("conjoint_sans_revenu", 0)

    children_keys = ["enfant_1", "enfant_2", "enfant_3", "enfant_4"]
    for i in range(children_count):
        deductions += family_cfg.get(children_keys[i], family_cfg.get("enfant", 0)) if i < len(children_keys) else family_cfg.get("enfant", 0)

    return round3(deductions)


def calculate_seniority_bonus(base_salary: float, hire_date_str: Optional[str]) -> float:
    if not hire_date_str:
        return 0.0

    try:
        hire_date = hire_date_str if isinstance(hire_date_str, date) else datetime.strptime(str(hire_date_str)[:10], "%Y-%m-%d").date()
    except (TypeError, ValueError):
        return 0.0

    years = (date.today() - hire_date).days / 365.25
    if years >= 20:
        rate = 20
    elif years >= 15:
        rate = 15
    elif years >= 10:
        rate = 10
    elif years >= 5:
        rate = 5
    elif years >= 2:
        rate = 2
    else:
        rate = 0
    return round3(base_salary * rate / 100)


def get_minimum_base_salary(employee: Optional[Dict], config: Dict) -> float:
    employee = employee or {}
    minimum_wages = config.get("minimum_wages", {})
    work_regime = employee.get("work_regime") or "48h"
    if work_regime == "40h":
        return parse_number(minimum_wages.get("smig_40h_monthly"))
    return parse_number(minimum_wages.get("smig_48h_monthly"))


def sanitize_prime(prime: Dict) -> Dict:
    return {
        "code": prime.get("code", ""),
        "name": prime.get("name") or prime.get("label") or prime.get("code", ""),
        "amount": parse_number(prime.get("amount")),
        "is_mandatory": bool(prime.get("is_mandatory", False)),
        "editable": bool(prime.get("editable", True)),
        "source": prime.get("source"),
        "calculation": prime.get("calculation", "fixed_monthly"),
        "cnss_applicable": bool(prime.get("cnss_applicable", True)),
        "irpp_applicable": bool(prime.get("irpp_applicable", True)),
    }


def merge_primes(mandatory_primes: List[Dict], custom_primes: List[Dict]) -> List[Dict]:
    merged: Dict[str, Dict] = {}
    for prime in mandatory_primes:
        normalized = sanitize_prime(prime)
        merged[normalized["code"]] = normalized

    for prime in custom_primes:
        normalized = sanitize_prime(prime)
        key = normalized["code"] or normalized["name"]
        if not key:
            continue
        if key in merged:
            merged[key]["amount"] = round3(max(merged[key]["amount"], normalized["amount"]))
            merged[key]["editable"] = merged[key]["editable"] or normalized["editable"]
            if normalized["source"]:
                merged[key]["source"] = normalized["source"]
        else:
            merged[key] = normalized
    return [prime for prime in merged.values() if prime["amount"] > 0]


def get_cnss_rates(config: Dict, convention_profile: Dict) -> Dict:
    cnss_config = config.get("cnss_config", {})
    breakdown = cnss_config.get("breakdown") or DEFAULT_HR_CONFIG["cnss_config"]["breakdown"]
    base_employer_rate = parse_number(cnss_config.get("employer_rate", DEFAULT_HR_CONFIG["cnss_config"]["employer_rate"]))
    employee_rate = parse_number(cnss_config.get("employee_rate", DEFAULT_HR_CONFIG["cnss_config"]["employee_rate"]))
    default_accident = parse_number(CNSS_RATES["regime_general"]["breakdown"]["accident"]["employer"])
    configured_accident = parse_number(breakdown.get("accident", {}).get("employer", default_accident))
    sector_accident = configured_accident
    accident_rate = configured_accident
    sector_code = convention_profile.get("accident_sector")
    if sector_code:
        accident_rate = parse_number(CNSS_ACCIDENT_RATES_BY_SECTOR.get(sector_code, configured_accident))
    employer_rate = round3(base_employer_rate - sector_accident + accident_rate)
    return {
        "employee_rate": employee_rate,
        "employer_rate": employer_rate,
        "ceiling": cnss_config.get("plafond_mensuel"),
    }


def get_tfp_rate(config: Dict, convention_profile: Dict) -> float:
    tfp_cfg = config.get("parafiscal_config", {}).get("tfp", {})
    category = convention_profile.get("tfp_category", "autres")
    if category == "industrie":
        return parse_number(tfp_cfg.get("rate_industrie", tfp_cfg.get("rate", DEFAULT_HR_CONFIG["parafiscal_config"]["tfp"]["rate_industrie"])))
    return parse_number(tfp_cfg.get("rate_autres", tfp_cfg.get("rate", DEFAULT_HR_CONFIG["parafiscal_config"]["tfp"]["rate_autres"])))


def build_salary_breakdown(
    employee: Dict,
    config: Dict,
    extras: Optional[Dict] = None,
    net_target: Optional[float] = None,
    solved_base_salary: Optional[float] = None,
) -> Dict:
    extras = extras or {}
    convention_profile = resolve_convention_for_config(config)
    minimum_base_salary = get_minimum_base_salary(employee, config)
    input_base_salary = parse_number(solved_base_salary if solved_base_salary is not None else employee.get("base_salary", 0))
    base_salary = max(input_base_salary, minimum_base_salary) if config.get("minimum_wages", {}).get("enforce_minimum", True) else input_base_salary

    mandatory_primes = get_mandatory_primes_for_employee(employee, convention_profile)
    custom_primes = employee.get("primes") or []
    all_primes = merge_primes(mandatory_primes, custom_primes)

    seniority_bonus = calculate_seniority_bonus(base_salary, employee.get("hire_date"))
    extra_hours = parse_number(extras.get("heures_sup"))
    extra_bonus = parse_number(extras.get("primes_exceptionnelles"))
    other_deductions_amount = parse_number(extras.get("other_deductions"))

    cnss_prime_total = round3(sum(p["amount"] for p in all_primes if p.get("cnss_applicable", True)))
    irpp_prime_total = round3(sum(p["amount"] for p in all_primes if p.get("irpp_applicable", True)))
    total_primes = round3(sum(p["amount"] for p in all_primes))

    total_brut = round3(base_salary + total_primes + seniority_bonus + extra_hours + extra_bonus)
    cnss_base = round3(base_salary + cnss_prime_total + seniority_bonus + extra_hours + extra_bonus)
    irpp_base = round3(base_salary + irpp_prime_total + seniority_bonus + extra_hours + extra_bonus)

    cnss_rates = get_cnss_rates(config, convention_profile)
    employee_rate = cnss_rates["employee_rate"]
    employer_rate = cnss_rates["employer_rate"]
    cnss_ceiling = cnss_rates.get("ceiling")
    if cnss_ceiling:
        cnss_base = min(cnss_base, parse_number(cnss_ceiling))

    cnss_salariale = round3(cnss_base * employee_rate / 100)

    pro_expenses_cfg = config.get("irpp_config", {}).get("professional_expenses", DEFAULT_HR_CONFIG["irpp_config"]["professional_expenses"])
    pro_rate = parse_number(pro_expenses_cfg.get("rate", 10))
    monthly_cap = parse_number(pro_expenses_cfg.get("monthly_cap") or parse_number(pro_expenses_cfg.get("annual_cap", 2000)) / 12)
    frais_pro = round3(min(irpp_base * pro_rate / 100, monthly_cap))
    taxable = round3(max(0.0, irpp_base - cnss_salariale - frais_pro))

    family_deductions = calculate_family_deductions(employee, config)
    irpp = calculate_irpp_monthly(taxable, family_deductions)
    css_rate = parse_number(config.get("irpp_config", {}).get("css_rate", DEFAULT_HR_CONFIG["irpp_config"]["css_rate"]))
    css = round3(taxable * css_rate / 100)
    total_deductions = round3(cnss_salariale + irpp + css + other_deductions_amount)
    net_a_payer = round3(total_brut - total_deductions)

    cnss_patronale = round3(cnss_base * employer_rate / 100)
    tfp_rate = get_tfp_rate(config, convention_profile)
    foprolos_rate = parse_number(config.get("parafiscal_config", {}).get("foprolos", {}).get("rate", DEFAULT_HR_CONFIG["parafiscal_config"]["foprolos"]["rate"]))
    tfp = round3(total_brut * tfp_rate / 100)
    foprolos = round3(total_brut * foprolos_rate / 100)
    total_employer_charges = round3(cnss_patronale + tfp + foprolos)
    cost_total_employer = round3(total_brut + total_employer_charges)

    gains = [{"code": "SAL_BASE", "label": "Salaire de base", "amount": round3(base_salary)}]
    gains.extend({
        "code": p["code"],
        "label": p["name"],
        "amount": p["amount"],
        "is_mandatory": p["is_mandatory"],
        "source": p.get("source"),
    } for p in all_primes)
    if seniority_bonus > 0:
        gains.append({"code": "PRIM_ANCIENNETE", "label": "Prime d'ancienneté", "amount": seniority_bonus, "is_mandatory": True})
    if extra_hours > 0:
        gains.append({"code": "HEURES_SUP", "label": "Heures supplémentaires", "amount": extra_hours})
    if extra_bonus > 0:
        gains.append({"code": "PRIME_EXCEPT", "label": "Prime exceptionnelle", "amount": extra_bonus})

    deductions = [
        {"code": "CNSS_SAL", "label": "CNSS salariale", "amount": cnss_salariale},
        {"code": "IRPP", "label": "IRPP", "amount": irpp},
        {"code": "CSS", "label": "Contribution Sociale de Solidarité", "amount": css},
    ]
    if other_deductions_amount > 0:
        deductions.append({"code": "AUTRES", "label": "Autres retenues", "amount": other_deductions_amount})

    employer_charges = [
        {"code": "CNSS_PAT", "label": "CNSS patronale", "amount": cnss_patronale},
        {"code": "TFP", "label": "Taxe de Formation Professionnelle", "amount": tfp},
        {"code": "FOPROLOS", "label": "FOPROLOS", "amount": foprolos},
    ]

    return {
        "salary_input_mode": employee.get("salary_input_mode", "gross_base"),
        "net_target": round3(net_target if net_target is not None else employee.get("net_target", 0)),
        "base_salary": round3(base_salary),
        "base_salary_gross": round3(base_salary),
        "minimum_base_salary": round3(minimum_base_salary),
        "total_primes": total_primes,
        "mandatory_primes": [p for p in all_primes if p.get("is_mandatory")],
        "primes": all_primes,
        "seniority_bonus": seniority_bonus,
        "total_brut": total_brut,
        "gross_salary": total_brut,
        "cnss_employee": cnss_salariale,
        "irpp_taxable_base": taxable,
        "family_deductions_annual": family_deductions,
        "irpp": irpp,
        "css": css,
        "total_deductions": total_deductions,
        "net_a_payer": net_a_payer,
        "net_salary": net_a_payer,
        "cnss_employer": cnss_patronale,
        "tfp": tfp,
        "foprolos": foprolos,
        "employer_charges_total": total_employer_charges,
        "total_employer_charges": total_employer_charges,
        "cost_total_employer": cost_total_employer,
        "gains": gains,
        "deductions": deductions,
        "employer_charges": employer_charges,
        "convention_profile": convention_profile,
        "salary_breakdown_snapshot": {
            "base_salary_gross": round3(base_salary),
            "net_target": round3(net_target if net_target is not None else employee.get("net_target", 0)),
            "total_brut": total_brut,
            "net_a_payer": net_a_payer,
            "total_deductions": total_deductions,
            "total_employer_charges": total_employer_charges,
            "mandatory_primes": [p for p in all_primes if p.get("is_mandatory")],
            "primes": all_primes,
            "convention_code": convention_profile.get("code"),
        },
    }


def solve_base_salary_from_net_target(
    employee: Dict,
    config: Dict,
    net_target: float,
    extras: Optional[Dict] = None,
) -> Dict:
    target = parse_number(net_target)
    minimum_base = get_minimum_base_salary(employee, config)
    low = minimum_base
    high = max(target * 3, minimum_base + 1000, 1000.0)

    def simulate(base_salary: float) -> Dict:
        temp_employee = {**employee, "base_salary": base_salary, "salary_input_mode": "net_target"}
        return build_salary_breakdown(temp_employee, config, extras=extras, net_target=target, solved_base_salary=base_salary)

    result = simulate(high)
    attempts = 0
    while result["net_a_payer"] < target and attempts < 20:
        high *= 1.5
        result = simulate(high)
        attempts += 1

    best = result
    for _ in range(40):
        mid = (low + high) / 2
        current = simulate(mid)
        if abs(current["net_a_payer"] - target) < 0.005:
            best = current
            break
        if current["net_a_payer"] < target:
            low = mid
        else:
            high = mid
        best = current

    best["base_salary"] = round3(best["base_salary"])
    best["base_salary_gross"] = round3(best["base_salary_gross"])
    best["net_target"] = target
    return best

