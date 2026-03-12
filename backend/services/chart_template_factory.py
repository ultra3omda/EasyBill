from data.chart_templates.france import build_france_chart_template
from data.chart_templates.tunisia import build_tunisia_chart_template


class ChartTemplateFactory:
    @staticmethod
    def normalize_country_code(country_code: str | None) -> str:
        if not country_code:
            return "TN"
        code = str(country_code).strip().upper()
        aliases = {
            "TUNISIA": "TN",
            "TUNISIE": "TN",
            "TN": "TN",
            "FRANCE": "FR",
            "FR": "FR",
        }
        return aliases.get(code, code)

    @classmethod
    def build_default_chart(cls, country_code: str | None):
        normalized = cls.normalize_country_code(country_code)
        if normalized == "FR":
            return build_france_chart_template()
        return build_tunisia_chart_template()
