"""
Moteur de calcul de paie - Réglementation tunisienne
Calcul IRPP, CNSS, CSS, charges patronales, et génération des bulletins de paie.
Conforme au Code du Travail tunisien et à la législation fiscale/sociale en vigueur.
"""

from motor.motor_asyncio import AsyncIOMotorClient
from bson import ObjectId
from datetime import datetime, timezone, date
from typing import Optional, Dict, List, Any
import os
import copy
import logging

from data.tunisian_hr_config import DEFAULT_HR_CONFIG

logger = logging.getLogger(__name__)

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]


async def get_active_config(company_id: str) -> dict:
    """Charge la configuration RH active depuis MongoDB pour une entreprise."""
    config = await db.company_hr_config.find_one({
        "company_id": ObjectId(company_id),
        "is_active": True
    })
    if not config:
        logger.info("No HR config found for company %s, initializing defaults", company_id)
        config = await initialize_default_config(company_id)
    return config


async def initialize_default_config(company_id: str) -> dict:
    """Crée et sauvegarde la configuration RH par défaut (barèmes tunisiens)."""
    config_doc = {
        "company_id": ObjectId(company_id),
        "is_active": True,
        "irpp_config": copy.deepcopy(DEFAULT_HR_CONFIG["irpp_config"]),
        "cnss_config": copy.deepcopy(DEFAULT_HR_CONFIG["cnss_config"]),
        "parafiscal_config": copy.deepcopy(DEFAULT_HR_CONFIG["parafiscal_config"]),
        "minimum_wages": copy.deepcopy(DEFAULT_HR_CONFIG["minimum_wages"]),
        "contract_types_config": copy.deepcopy(DEFAULT_HR_CONFIG["contract_types_config"]),
        "payroll_rubrics_config": copy.deepcopy(DEFAULT_HR_CONFIG["payroll_rubrics_config"]),
        "leave_types_config": copy.deepcopy(DEFAULT_HR_CONFIG["leave_types_config"]),
        "accounting_config": copy.deepcopy(DEFAULT_HR_CONFIG["accounting_config"]),
        "declarations_config": copy.deepcopy(DEFAULT_HR_CONFIG["declarations_config"]),
        "created_at": datetime.now(timezone.utc),
        "updated_at": datetime.now(timezone.utc),
    }
    result = await db.company_hr_config.insert_one(config_doc)
    config_doc["_id"] = result.inserted_id
    logger.info("Default HR config created for company %s", company_id)
    return config_doc


def calculate_irpp_monthly(monthly_taxable_income: float, family_deductions_annual: float = 0) -> float:
    """
    Calcule l'IRPP mensuel selon le barème progressif tunisien.
    1. Annualise le revenu imposable mensuel (×12)
    2. Applique les tranches progressives
    3. Soustrait les déductions familiales annuelles
    4. Divise par 12 pour obtenir le montant mensuel
    """
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

        if bracket_max is None:
            taxable_in_bracket = annual_taxable - bracket_min
        else:
            taxable_in_bracket = min(annual_taxable, bracket_max) - bracket_min

        if taxable_in_bracket > 0:
            annual_irpp += taxable_in_bracket * rate / 100

    annual_irpp -= family_deductions_annual
    if annual_irpp < 0:
        annual_irpp = 0.0

    monthly_irpp = annual_irpp / 12
    return round(monthly_irpp, 3)


def calculate_family_deductions(employee: dict, config: dict) -> float:
    """
    Calcule les déductions familiales annuelles selon la situation de l'employé.
    Prend en compte : statut marital, nombre d'enfants, personnes à charge.
    """
    family_cfg = config.get("irpp_config", {}).get("family_deductions", {})
    deductions = 0.0

    marital_status = employee.get("marital_status", "single")
    children_count = employee.get("children_count", 0)
    dependents = employee.get("dependents", [])

    if marital_status == "married":
        deductions += family_cfg.get("chef_de_famille", 0)
        if employee.get("spouse_dependent", False):
            deductions += family_cfg.get("conjoint_a_charge", 0)

    children_keys = ["enfant_1", "enfant_2", "enfant_3", "enfant_4"]
    for i in range(children_count):
        if i < len(children_keys):
            deductions += family_cfg.get(children_keys[i], 0)
        else:
            deductions += family_cfg.get("enfant_supplementaire", 0)

    for dep in dependents:
        if dep.get("type") == "parent":
            deductions += family_cfg.get("parent_a_charge", 0)
        elif dep.get("type") == "handicape":
            deductions += family_cfg.get("handicape", 0)

    return deductions


def calculate_seniority_bonus(base_salary: float, hire_date_str: str) -> float:
    """
    Calcule la prime d'ancienneté selon le barème légal tunisien.
    2% après 2 ans, 5% après 5 ans, 10% après 10 ans,
    15% après 15 ans, 20% après 20 ans.
    """
    try:
        if isinstance(hire_date_str, datetime):
            hire_date = hire_date_str.date() if hasattr(hire_date_str, 'date') else hire_date_str
        elif isinstance(hire_date_str, date):
            hire_date = hire_date_str
        else:
            hire_date = datetime.strptime(str(hire_date_str)[:10], "%Y-%m-%d").date()
    except (ValueError, TypeError):
        logger.warning("Invalid hire_date format: %s", hire_date_str)
        return 0.0

    today = date.today()
    years = (today - hire_date).days / 365.25

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

    return round(base_salary * rate / 100, 3)


async def calculate_payslip(employee: dict, month: int, year: int, company_id: str, extras: dict = None) -> dict:
    """
    Calcule un bulletin de paie complet pour un employé.
    Retourne un dict avec gains, déductions, charges patronales et net à payer.
    """
    config = await get_active_config(company_id)
    extras = extras or {}

    base_salary = employee.get("base_salary", 0)
    monthly_primes = employee.get("monthly_primes", 0)
    hire_date_str = employee.get("hire_date", "")

    seniority_bonus = calculate_seniority_bonus(base_salary, hire_date_str)
    heures_sup = extras.get("heures_sup", 0)
    primes_exceptionnelles = extras.get("primes_exceptionnelles", 0)

    # --- Salaire brut ---
    total_brut = base_salary + monthly_primes + seniority_bonus + heures_sup + primes_exceptionnelles

    gains = [
        {"code": "SAL_BASE", "label": "Salaire de base", "amount": round(base_salary, 3)},
    ]
    if monthly_primes > 0:
        gains.append({"code": "PRIMES", "label": "Primes mensuelles", "amount": round(monthly_primes, 3)})
    if seniority_bonus > 0:
        gains.append({"code": "PRIME_ANC", "label": "Prime d'ancienneté", "amount": round(seniority_bonus, 3)})
    if heures_sup > 0:
        gains.append({"code": "HEURES_SUP", "label": "Heures supplémentaires", "amount": round(heures_sup, 3)})
    if primes_exceptionnelles > 0:
        gains.append({"code": "PRIME_EXCEPT", "label": "Prime exceptionnelle", "amount": round(primes_exceptionnelles, 3)})

    total_brut = round(total_brut, 3)

    # --- CNSS salariale ---
    cnss_employee_rate = config.get("cnss_config", {}).get("employee_rate", DEFAULT_HR_CONFIG["cnss_config"]["employee_rate"])
    cnss_salariale = round(total_brut * cnss_employee_rate / 100, 3)

    # --- Frais professionnels ---
    pro_expenses_cfg = config.get("irpp_config", {}).get("professional_expenses", DEFAULT_HR_CONFIG["irpp_config"]["professional_expenses"])
    pro_rate = pro_expenses_cfg.get("rate", 10)
    annual_cap = pro_expenses_cfg.get("annual_cap", 2000)
    monthly_cap = round(annual_cap / 12, 3)
    frais_pro = round(min(total_brut * pro_rate / 100, monthly_cap), 3)

    # --- Revenu imposable ---
    taxable = round(total_brut - cnss_salariale - frais_pro, 3)
    if taxable < 0:
        taxable = 0.0

    # --- Déductions familiales et IRPP ---
    family_deductions = calculate_family_deductions(employee, config)
    irpp = calculate_irpp_monthly(taxable, family_deductions)

    # --- CSS ---
    css_rate = config.get("irpp_config", {}).get("css_rate", DEFAULT_HR_CONFIG["irpp_config"]["css_rate"])
    css = round(taxable * css_rate / 100, 3)

    # --- Autres retenues ---
    other_deductions_amount = extras.get("other_deductions", 0)

    deductions = [
        {"code": "CNSS_SAL", "label": "CNSS salariale", "amount": cnss_salariale},
        {"code": "IRPP", "label": "IRPP", "amount": irpp},
        {"code": "CSS", "label": "Contribution Sociale de Solidarité", "amount": css},
    ]
    if other_deductions_amount > 0:
        deductions.append({"code": "AUTRES", "label": "Autres retenues", "amount": round(other_deductions_amount, 3)})

    total_deductions = round(cnss_salariale + irpp + css + other_deductions_amount, 3)

    # --- Net à payer ---
    net_a_payer = round(total_brut - total_deductions, 3)

    # --- Charges patronales ---
    cnss_employer_rate = config.get("cnss_config", {}).get("employer_rate", DEFAULT_HR_CONFIG["cnss_config"]["employer_rate"])
    cnss_patronale = round(total_brut * cnss_employer_rate / 100, 3)

    tfp_rate = config.get("parafiscal_config", {}).get("tfp", {}).get("rate", DEFAULT_HR_CONFIG["parafiscal_config"]["tfp"]["rate"])
    foprolos_rate = config.get("parafiscal_config", {}).get("foprolos", {}).get("rate", DEFAULT_HR_CONFIG["parafiscal_config"]["foprolos"]["rate"])
    tfp = round(total_brut * tfp_rate / 100, 3)
    foprolos = round(total_brut * foprolos_rate / 100, 3)

    employer_charges = [
        {"code": "CNSS_PAT", "label": "CNSS patronale", "amount": cnss_patronale},
        {"code": "TFP", "label": "Taxe de Formation Professionnelle", "amount": tfp},
        {"code": "FOPROLOS", "label": "FOPROLOS", "amount": foprolos},
    ]
    total_employer_charges = round(cnss_patronale + tfp + foprolos, 3)
    cost_total_employer = round(total_brut + total_employer_charges, 3)

    employee_id = employee.get("_id")
    if isinstance(employee_id, ObjectId):
        employee_id = str(employee_id)

    payslip = {
        "employee_id": employee_id,
        "month": month,
        "year": year,
        "gains": gains,
        "total_brut": total_brut,
        "deductions": deductions,
        "total_deductions": total_deductions,
        "net_a_payer": net_a_payer,
        "employer_charges": employer_charges,
        "total_employer_charges": total_employer_charges,
        "cost_total_employer": cost_total_employer,
    }

    logger.info(
        "Payslip calculated for employee %s — %02d/%d: brut=%.3f, net=%.3f",
        employee_id, month, year, total_brut, net_a_payer
    )
    return payslip


async def generate_payroll_journal_entry(payslips: list, company_id: str, month: int, year: int) -> dict:
    """
    Génère l'écriture comptable du journal de paie à partir d'une liste de bulletins.
    Comptes utilisés (plan comptable tunisien) :
      D 6311 Salaires et traitements
      D 6341 CNSS patronale
      D 6358 TFP + FOPROLOS
      C 421  Personnel — Rémunérations dues
      C 431  CNSS à payer
      C 4353 IRPP + CSS retenus à la source
      C 4358 TFP + FOPROLOS à payer
    """
    config = await get_active_config(company_id)
    accounts = config.get("accounting_config", {}).get("accounts", DEFAULT_HR_CONFIG["accounting_config"]["accounts"])

    total_brut = 0.0
    total_net = 0.0
    total_cnss_salariale = 0.0
    total_irpp = 0.0
    total_css = 0.0
    total_cnss_patronale = 0.0
    total_tfp = 0.0
    total_foprolos = 0.0

    for ps in payslips:
        total_brut += ps.get("total_brut", 0)
        total_net += ps.get("net_a_payer", 0)

        for d in ps.get("deductions", []):
            if d["code"] == "CNSS_SAL":
                total_cnss_salariale += d["amount"]
            elif d["code"] == "IRPP":
                total_irpp += d["amount"]
            elif d["code"] == "CSS":
                total_css += d["amount"]

        for ec in ps.get("employer_charges", []):
            if ec["code"] == "CNSS_PAT":
                total_cnss_patronale += ec["amount"]
            elif ec["code"] == "TFP":
                total_tfp += ec["amount"]
            elif ec["code"] == "FOPROLOS":
                total_foprolos += ec["amount"]

    total_brut = round(total_brut, 3)
    total_net = round(total_net, 3)
    total_cnss_salariale = round(total_cnss_salariale, 3)
    total_irpp = round(total_irpp, 3)
    total_css = round(total_css, 3)
    total_cnss_patronale = round(total_cnss_patronale, 3)
    total_tfp = round(total_tfp, 3)
    total_foprolos = round(total_foprolos, 3)

    total_cnss_a_payer = round(total_cnss_salariale + total_cnss_patronale, 3)
    total_irpp_css = round(total_irpp + total_css, 3)
    total_tfp_foprolos = round(total_tfp + total_foprolos, 3)

    reference = f"PA-{year}-{month:02d}"
    entry_date = datetime(year, month, 1, tzinfo=timezone.utc)

    lines = [
        {
            "account_code": accounts["salaires_bruts"]["code"],
            "account_label": accounts["salaires_bruts"]["label"],
            "debit": total_brut,
            "credit": 0,
        },
        {
            "account_code": accounts["cnss_patronale"]["code"],
            "account_label": accounts["cnss_patronale"]["label"],
            "debit": total_cnss_patronale,
            "credit": 0,
        },
        {
            "account_code": accounts["tfp_foprolos"]["code"],
            "account_label": accounts["tfp_foprolos"]["label"],
            "debit": total_tfp_foprolos,
            "credit": 0,
        },
        {
            "account_code": accounts["net_a_payer"]["code"],
            "account_label": accounts["net_a_payer"]["label"],
            "debit": 0,
            "credit": total_net,
        },
        {
            "account_code": accounts["cnss_a_payer"]["code"],
            "account_label": accounts["cnss_a_payer"]["label"],
            "debit": 0,
            "credit": total_cnss_a_payer,
        },
        {
            "account_code": accounts["irpp_css"]["code"],
            "account_label": accounts["irpp_css"]["label"],
            "debit": 0,
            "credit": total_irpp_css,
        },
        {
            "account_code": accounts["tfp_foprolos_a_payer"]["code"],
            "account_label": accounts["tfp_foprolos_a_payer"]["label"],
            "debit": 0,
            "credit": total_tfp_foprolos,
        },
    ]

    journal_entry = {
        "company_id": ObjectId(company_id),
        "reference": reference,
        "date": entry_date,
        "journal_code": config.get("accounting_config", {}).get("journal_code", "PA"),
        "journal_label": config.get("accounting_config", {}).get("journal_label", "Journal de Paie"),
        "description": f"Paie du mois {month:02d}/{year}",
        "lines": lines,
        "total_debit": round(total_brut + total_cnss_patronale + total_tfp_foprolos, 3),
        "total_credit": round(total_net + total_cnss_a_payer + total_irpp_css + total_tfp_foprolos, 3),
        "payslip_count": len(payslips),
        "created_at": datetime.now(timezone.utc),
    }

    logger.info(
        "Payroll journal entry generated: %s — %d payslips, total brut=%.3f",
        reference, len(payslips), total_brut
    )
    return journal_entry
