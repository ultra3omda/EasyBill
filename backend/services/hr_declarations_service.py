"""
Service de génération des déclarations RH tunisiennes
CNSS trimestrielle, IRPP mensuelle, déclaration annuelle, certificat de retenue
"""

from motor.motor_asyncio import AsyncIOMotorClient
from bson import ObjectId
from datetime import datetime, timezone
import os
import logging

logger = logging.getLogger(__name__)

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]


def _get_quarter_months(quarter: int) -> list:
    """Return the 3 month numbers for a given quarter (1-4)."""
    start = (quarter - 1) * 3 + 1
    return [start, start + 1, start + 2]


def _extract_deduction(deductions: list, code: str) -> float:
    """Extract amount for a given code from a deductions/charges list."""
    for item in deductions:
        if item.get("code") == code:
            return item.get("amount", 0)
    return 0


async def generate_cnss_quarterly(company_id: str, quarter: int, year: int) -> dict:
    """
    Génère la déclaration trimestrielle CNSS (format DS7).
    Regroupe les bulletins validés du trimestre par employé.
    """
    logger.info(f"Generating CNSS quarterly declaration Q{quarter}/{year} for company {company_id}")

    months = _get_quarter_months(quarter)

    payslips = await db.hr_payslips.find({
        "company_id": ObjectId(company_id),
        "month": {"$in": months},
        "year": year,
        "status": "validated"
    }).to_list(None)

    logger.info(f"Found {len(payslips)} validated payslips for Q{quarter}/{year}")

    employee_map = {}
    for ps in payslips:
        emp_id = str(ps["employee_id"])
        if emp_id not in employee_map:
            employee_map[emp_id] = {
                "employee_id": emp_id,
                "total_brut": 0,
                "cnss_employee": 0,
                "cnss_employer": 0,
            }
        entry = employee_map[emp_id]
        entry["total_brut"] += ps.get("total_brut", 0)
        entry["cnss_employee"] += _extract_deduction(ps.get("deductions", []), "CNSS")
        entry["cnss_employer"] += _extract_deduction(ps.get("employer_charges", []), "CNSS_PATRONALE")

    # Fetch employee details for matricule, name, cnss_number
    employees_list = []
    for emp_id, data in employee_map.items():
        emp = await db.hr_employees.find_one({"_id": ObjectId(emp_id)})
        employees_list.append({
            "employee_id": emp_id,
            "matricule": emp.get("matricule", "") if emp else "",
            "name": emp.get("name", "") if emp else "",
            "cnss_number": emp.get("cnss_number", "") if emp else "",
            "total_brut": round(data["total_brut"], 3),
            "cnss_employee": round(data["cnss_employee"], 3),
            "cnss_employer": round(data["cnss_employer"], 3),
        })

    total_brut = round(sum(e["total_brut"] for e in employees_list), 3)
    total_cnss_employee = round(sum(e["cnss_employee"] for e in employees_list), 3)
    total_cnss_employer = round(sum(e["cnss_employer"] for e in employees_list), 3)

    return {
        "declaration_type": "CNSS_DS7",
        "quarter": quarter,
        "year": year,
        "company_id": company_id,
        "employees": employees_list,
        "totals": {
            "total_brut": total_brut,
            "total_cnss_employee": total_cnss_employee,
            "total_cnss_employer": total_cnss_employer,
            "total_cnss": round(total_cnss_employee + total_cnss_employer, 3),
        },
        "generated_at": datetime.now(timezone.utc).isoformat(),
    }


async def generate_monthly_irpp(company_id: str, month: int, year: int) -> dict:
    """
    Génère la déclaration mensuelle IRPP / TFP / FOPROLOS.
    Agrège les retenues fiscales et parafiscales du mois.
    """
    logger.info(f"Generating monthly IRPP declaration {month:02d}/{year} for company {company_id}")

    payslips = await db.hr_payslips.find({
        "company_id": ObjectId(company_id),
        "month": month,
        "year": year,
        "status": "validated"
    }).to_list(None)

    logger.info(f"Found {len(payslips)} validated payslips for {month:02d}/{year}")

    total_irpp = 0
    total_css = 0
    total_tfp = 0
    total_foprolos = 0

    for ps in payslips:
        deductions = ps.get("deductions", [])
        charges = ps.get("employer_charges", [])
        total_irpp += _extract_deduction(deductions, "IRPP")
        total_css += _extract_deduction(deductions, "CSS")
        total_tfp += _extract_deduction(charges, "TFP")
        total_foprolos += _extract_deduction(charges, "FOPROLOS")

    total_irpp = round(total_irpp, 3)
    total_css = round(total_css, 3)
    total_irpp_css = round(total_irpp + total_css, 3)
    total_tfp = round(total_tfp, 3)
    total_foprolos = round(total_foprolos, 3)
    total_parafiscal = round(total_tfp + total_foprolos, 3)
    grand_total = round(total_irpp_css + total_parafiscal, 3)

    return {
        "declaration_type": "MONTHLY_IRPP",
        "month": month,
        "year": year,
        "company_id": company_id,
        "totals": {
            "total_irpp": total_irpp,
            "total_css": total_css,
            "total_irpp_css": total_irpp_css,
            "total_tfp": total_tfp,
            "total_foprolos": total_foprolos,
            "total_parafiscal": total_parafiscal,
            "grand_total": grand_total,
        },
        "employee_count": len(payslips),
        "generated_at": datetime.now(timezone.utc).isoformat(),
    }


async def generate_annual_declaration(company_id: str, year: int) -> dict:
    """
    Génère la déclaration annuelle des salaires.
    Regroupe tous les bulletins validés de l'année par employé.
    """
    logger.info(f"Generating annual declaration {year} for company {company_id}")

    payslips = await db.hr_payslips.find({
        "company_id": ObjectId(company_id),
        "year": year,
        "status": "validated"
    }).to_list(None)

    logger.info(f"Found {len(payslips)} validated payslips for year {year}")

    employee_map = {}
    for ps in payslips:
        emp_id = str(ps["employee_id"])
        if emp_id not in employee_map:
            employee_map[emp_id] = {
                "employee_id": emp_id,
                "total_brut": 0,
                "total_cnss": 0,
                "total_irpp": 0,
                "total_css": 0,
                "total_net": 0,
            }
        entry = employee_map[emp_id]
        entry["total_brut"] += ps.get("total_brut", 0)
        entry["total_cnss"] += _extract_deduction(ps.get("deductions", []), "CNSS")
        entry["total_irpp"] += _extract_deduction(ps.get("deductions", []), "IRPP")
        entry["total_css"] += _extract_deduction(ps.get("deductions", []), "CSS")
        entry["total_net"] += ps.get("net_a_payer", 0)

    # Fetch employee details
    employees_list = []
    for emp_id, data in employee_map.items():
        emp = await db.hr_employees.find_one({"_id": ObjectId(emp_id)})
        employees_list.append({
            "employee_id": emp_id,
            "matricule": emp.get("matricule", "") if emp else "",
            "name": emp.get("name", "") if emp else "",
            "total_brut": round(data["total_brut"], 3),
            "total_cnss": round(data["total_cnss"], 3),
            "total_irpp": round(data["total_irpp"], 3),
            "total_css": round(data["total_css"], 3),
            "total_net": round(data["total_net"], 3),
        })

    company_totals = {
        "total_brut": round(sum(e["total_brut"] for e in employees_list), 3),
        "total_cnss": round(sum(e["total_cnss"] for e in employees_list), 3),
        "total_irpp": round(sum(e["total_irpp"] for e in employees_list), 3),
        "total_css": round(sum(e["total_css"] for e in employees_list), 3),
        "total_net": round(sum(e["total_net"] for e in employees_list), 3),
    }

    return {
        "declaration_type": "ANNUAL_SALARY",
        "year": year,
        "company_id": company_id,
        "employees": employees_list,
        "company_totals": company_totals,
        "employee_count": len(employees_list),
        "generated_at": datetime.now(timezone.utc).isoformat(),
    }


async def generate_withholding_certificate(company_id: str, employee_id: str, year: int) -> dict:
    """
    Génère le certificat de retenue à la source pour un employé.
    Détail mensuel + totaux annuels.
    """
    logger.info(f"Generating withholding certificate {year} for employee {employee_id}")

    employee = await db.hr_employees.find_one({"_id": ObjectId(employee_id)})
    if not employee:
        raise ValueError(f"Employee {employee_id} not found")

    payslips = await db.hr_payslips.find({
        "company_id": ObjectId(company_id),
        "employee_id": ObjectId(employee_id),
        "year": year,
        "status": "validated"
    }).sort("month", 1).to_list(None)

    logger.info(f"Found {len(payslips)} payslips for employee {employee_id}, year {year}")

    monthly_detail = []
    annual_brut = 0
    annual_cnss = 0
    annual_irpp = 0
    annual_css = 0
    annual_net = 0

    for ps in payslips:
        brut = ps.get("total_brut", 0)
        cnss = _extract_deduction(ps.get("deductions", []), "CNSS")
        irpp = _extract_deduction(ps.get("deductions", []), "IRPP")
        css = _extract_deduction(ps.get("deductions", []), "CSS")
        net = ps.get("net_a_payer", 0)

        monthly_detail.append({
            "month": ps["month"],
            "total_brut": round(brut, 3),
            "cnss": round(cnss, 3),
            "irpp": round(irpp, 3),
            "css": round(css, 3),
            "net_a_payer": round(net, 3),
        })

        annual_brut += brut
        annual_cnss += cnss
        annual_irpp += irpp
        annual_css += css
        annual_net += net

    return {
        "declaration_type": "WITHHOLDING_CERTIFICATE",
        "year": year,
        "company_id": company_id,
        "employee": {
            "employee_id": employee_id,
            "matricule": employee.get("matricule", ""),
            "name": employee.get("name", ""),
            "cin": employee.get("cin", ""),
            "cnss_number": employee.get("cnss_number", ""),
        },
        "monthly_detail": monthly_detail,
        "annual_totals": {
            "total_brut": round(annual_brut, 3),
            "total_cnss": round(annual_cnss, 3),
            "total_irpp": round(annual_irpp, 3),
            "total_css": round(annual_css, 3),
            "total_net": round(annual_net, 3),
        },
        "generated_at": datetime.now(timezone.utc).isoformat(),
    }
