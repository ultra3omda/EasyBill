import asyncio
import copy
import os

import pytest

os.environ.setdefault("MONGO_URL", "mongodb://localhost:27017")
os.environ.setdefault("DB_NAME", "easybill_test")

from data.tunisian_hr_config import DEFAULT_HR_CONFIG
from services.payroll_convention_service import get_convention_profile
from services.payroll_salary_solver import build_salary_breakdown, solve_base_salary_from_net_target
from services import payroll_engine


def make_config(convention_code="services_administratifs"):
    config = copy.deepcopy(DEFAULT_HR_CONFIG)
    config["convention_collective_code"] = convention_code
    config["payroll_convention_profile"] = get_convention_profile(convention_code)
    return config


def make_employee(**overrides):
    employee = {
        "first_name": "Nadia",
        "last_name": "Souli",
        "hire_date": "2020-01-01",
        "work_regime": "48h",
        "professional_category": "employe",
        "marital_status": "celibataire",
        "children_count": 0,
        "primes": [],
        "salary_input_mode": "net_target",
        "net_target": 1200,
        "base_salary": 0,
    }
    employee.update(overrides)
    return employee


def test_solver_reaches_target_net_in_commerce_convention():
    config = make_config("commerce_gros_detail")
    employee = make_employee()

    result = solve_base_salary_from_net_target(employee, config, employee["net_target"])

    assert abs(result["net_a_payer"] - 1200) < 0.05
    codes = {prime["code"] for prime in result["mandatory_primes"]}
    assert "PRIM_TRANSPORT" in codes
    assert "PRIM_PRESENCE" in codes


def test_convention_prime_amount_depends_on_professional_category():
    config = make_config("commerce_gros_detail")

    employe_result = build_salary_breakdown(make_employee(professional_category="employe", base_salary=1500, net_target=0, salary_input_mode="gross_base"), config)
    cadre_result = build_salary_breakdown(make_employee(professional_category="cadre", base_salary=1500, net_target=0, salary_input_mode="gross_base"), config)

    employe_transport = next(prime["amount"] for prime in employe_result["mandatory_primes"] if prime["code"] == "PRIM_TRANSPORT")
    cadre_transport = next(prime["amount"] for prime in cadre_result["mandatory_primes"] if prime["code"] == "PRIM_TRANSPORT")

    assert cadre_transport > employe_transport
    assert employe_transport == pytest.approx(75.012, abs=0.001)
    assert cadre_transport == pytest.approx(82.746, abs=0.001)


def test_seniority_bonus_is_included_in_breakdown():
    config = make_config()
    result = build_salary_breakdown(
        make_employee(
            base_salary=2000,
            net_target=0,
            salary_input_mode="gross_base",
            hire_date="2010-01-01",
        ),
        config,
    )

    assert result["seniority_bonus"] > 0
    gain_codes = {gain["code"] for gain in result["gains"]}
    assert "PRIM_ANCIENNETE" in gain_codes


def test_calculate_payslip_reuses_same_solver(monkeypatch):
    config = make_config("commerce_gros_detail")
    employee = make_employee(net_target=1400)

    async def fake_get_active_config(company_id):
        return config

    monkeypatch.setattr(payroll_engine, "get_active_config", fake_get_active_config)

    payslip = asyncio.run(payroll_engine.calculate_payslip(employee, 3, 2026, "company-test"))

    assert abs(payslip["net_salary"] - 1400) < 0.05
    assert payslip["base_salary"] > 0
    assert any(prime["code"] == "PRIM_TRANSPORT" for prime in payslip["mandatory_primes"])
