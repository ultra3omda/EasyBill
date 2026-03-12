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
from services.payroll_salary_solver import (
    build_salary_breakdown,
    calculate_family_deductions as solver_calculate_family_deductions,
    calculate_irpp_monthly as solver_calculate_irpp_monthly,
    calculate_seniority_bonus as solver_calculate_seniority_bonus,
    parse_number,
    solve_base_salary_from_net_target,
)

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
    return solver_calculate_irpp_monthly(monthly_taxable_income, family_deductions_annual)


def calculate_family_deductions(employee: dict, config: dict) -> float:
    return solver_calculate_family_deductions(employee, config)


def calculate_seniority_bonus(base_salary: float, hire_date_str: str) -> float:
    return solver_calculate_seniority_bonus(base_salary, hire_date_str)


async def calculate_payslip(employee: dict, month: int, year: int, company_id: str, extras: dict = None) -> dict:
    """
    Calcule un bulletin de paie complet pour un employé.
    Retourne un dict avec gains, déductions, charges patronales et net à payer.
    """
    config = await get_active_config(company_id)
    extras = extras or {}
    base_salary = parse_number(employee.get("base_salary", 0))
    net_target = parse_number(employee.get("net_target", 0))

    if (employee.get("salary_input_mode") == "net_target" or net_target > 0) and base_salary <= 0:
        calculated = solve_base_salary_from_net_target(employee, config, net_target, extras=extras)
    else:
        calculated = build_salary_breakdown(employee, config, extras=extras)

    total_brut = calculated["total_brut"]
    total_deductions = calculated["total_deductions"]
    net_a_payer = calculated["net_a_payer"]
    gains = calculated["gains"]
    deductions = calculated["deductions"]
    employer_charges = calculated["employer_charges"]
    total_employer_charges = calculated["total_employer_charges"]
    cost_total_employer = calculated["cost_total_employer"]

    employee_id = employee.get("_id")
    if isinstance(employee_id, ObjectId):
        employee_id = str(employee_id)

    payslip = {
        "employee_id": employee_id,
        "month": month,
        "year": year,
        "base_salary": calculated["base_salary_gross"],
        "gains": gains,
        "total_brut": total_brut,
        "gross_salary": total_brut,
        "deductions": deductions,
        "total_deductions": total_deductions,
        "net_a_payer": net_a_payer,
        "net_salary": net_a_payer,
        "cnss_employee": calculated["cnss_employee"],
        "cnss_employer": calculated["cnss_employer"],
        "irpp": calculated["irpp"],
        "css": calculated["css"],
        "tfp": calculated["tfp"],
        "foprolos": calculated["foprolos"],
        "employer_charges": employer_charges,
        "employer_charges_total": total_employer_charges,
        "total_employer_charges": total_employer_charges,
        "cost_total_employer": cost_total_employer,
        "mandatory_primes": calculated["mandatory_primes"],
        "primes": calculated["primes"],
        "salary_breakdown_snapshot": calculated["salary_breakdown_snapshot"],
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
