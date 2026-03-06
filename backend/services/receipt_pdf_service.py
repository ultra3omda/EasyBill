"""
Service de Génération de Reçus PDF
Génère des reçus de paiement au format PDF
"""

from datetime import datetime
from typing import Optional, Dict, Any
from io import BytesIO
import logging

logger = logging.getLogger(__name__)


class ReceiptPDFService:
    """Service pour générer des reçus de paiement en PDF"""
    
    def __init__(self, db):
        self.db = db
    
    async def generate_payment_receipt(
        self,
        payment_id: str,
        company_id: str
    ) -> bytes:
        """
        Génère un reçu PDF pour un paiement
        
        Args:
            payment_id: ID du paiement
            company_id: ID de l'entreprise
            
        Returns:
            bytes: Contenu du PDF
        """
        from bson import ObjectId
        from reportlab.lib import colors
        from reportlab.lib.pagesizes import A4
        from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
        from reportlab.lib.units import mm
        from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, Image
        from reportlab.lib.enums import TA_CENTER, TA_RIGHT, TA_LEFT
        
        # Récupérer les données du paiement
        payment = await self.db.payments.find_one({
            "_id": ObjectId(payment_id),
            "company_id": ObjectId(company_id)
        })
        
        if not payment:
            raise ValueError("Paiement non trouvé")
        
        # Récupérer les données de l'entreprise
        company = await self.db.companies.find_one({"_id": ObjectId(company_id)})
        
        # Récupérer les données du client
        customer = None
        if payment.get("customer_id"):
            customer = await self.db.customers.find_one({"_id": payment["customer_id"]})
        
        # Récupérer la facture liée
        invoice = None
        if payment.get("invoice_id"):
            invoice = await self.db.invoices.find_one({"_id": payment["invoice_id"]})
        
        # Créer le PDF
        buffer = BytesIO()
        doc = SimpleDocTemplate(
            buffer,
            pagesize=A4,
            rightMargin=20*mm,
            leftMargin=20*mm,
            topMargin=20*mm,
            bottomMargin=20*mm
        )
        
        styles = getSampleStyleSheet()
        
        # Styles personnalisés
        title_style = ParagraphStyle(
            'Title',
            parent=styles['Heading1'],
            fontSize=24,
            alignment=TA_CENTER,
            spaceAfter=20,
            textColor=colors.HexColor('#6B46C1')
        )
        
        subtitle_style = ParagraphStyle(
            'Subtitle',
            parent=styles['Normal'],
            fontSize=12,
            alignment=TA_CENTER,
            spaceAfter=30,
            textColor=colors.grey
        )
        
        header_style = ParagraphStyle(
            'Header',
            parent=styles['Heading2'],
            fontSize=14,
            spaceAfter=10,
            textColor=colors.HexColor('#6B46C1')
        )
        
        normal_style = ParagraphStyle(
            'CustomNormal',
            parent=styles['Normal'],
            fontSize=11,
            spaceAfter=5
        )
        
        bold_style = ParagraphStyle(
            'Bold',
            parent=styles['Normal'],
            fontSize=11,
            fontName='Helvetica-Bold'
        )
        
        amount_style = ParagraphStyle(
            'Amount',
            parent=styles['Normal'],
            fontSize=18,
            fontName='Helvetica-Bold',
            alignment=TA_CENTER,
            textColor=colors.HexColor('#6B46C1')
        )
        
        elements = []
        
        # En-tête de l'entreprise
        company_name = company.get("name", "EasyBill") if company else "EasyBill"
        company_address = company.get("address", "") if company else ""
        company_tax_id = company.get("tax_id", "") if company else ""
        
        elements.append(Paragraph(company_name, title_style))
        if company_address:
            elements.append(Paragraph(company_address, subtitle_style))
        if company_tax_id:
            elements.append(Paragraph(f"MF: {company_tax_id}", subtitle_style))
        
        elements.append(Spacer(1, 10*mm))
        
        # Titre du reçu
        elements.append(Paragraph("REÇU DE PAIEMENT", title_style))
        
        receipt_number = payment.get("reference") or f"REC-{payment_id[-8:].upper()}"
        elements.append(Paragraph(f"N° {receipt_number}", subtitle_style))
        
        elements.append(Spacer(1, 10*mm))
        
        # Informations du paiement
        payment_date = payment.get("date", datetime.now())
        if isinstance(payment_date, str):
            payment_date = datetime.fromisoformat(payment_date.replace('Z', '+00:00'))
        
        info_data = [
            ["Date du paiement:", payment_date.strftime("%d/%m/%Y")],
            ["Mode de paiement:", self._get_payment_method_label(payment.get("method", "other"))],
        ]
        
        if payment.get("bank_reference"):
            info_data.append(["Référence bancaire:", payment.get("bank_reference")])
        
        if invoice:
            info_data.append(["Facture associée:", invoice.get("number", "N/A")])
        
        info_table = Table(info_data, colWidths=[60*mm, 100*mm])
        info_table.setStyle(TableStyle([
            ('FONTNAME', (0, 0), (0, -1), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, -1), 11),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
            ('ALIGN', (0, 0), (0, -1), 'LEFT'),
            ('ALIGN', (1, 0), (1, -1), 'LEFT'),
        ]))
        elements.append(info_table)
        
        elements.append(Spacer(1, 10*mm))
        
        # Informations du client
        if customer:
            elements.append(Paragraph("Reçu de:", header_style))
            
            customer_name = customer.get("company_name") or f"{customer.get('first_name', '')} {customer.get('last_name', '')}".strip()
            elements.append(Paragraph(customer_name, bold_style))
            
            if customer.get("address"):
                elements.append(Paragraph(customer.get("address"), normal_style))
            
            if customer.get("city"):
                city_line = f"{customer.get('postal_code', '')} {customer.get('city', '')}".strip()
                elements.append(Paragraph(city_line, normal_style))
            
            if customer.get("tax_id"):
                elements.append(Paragraph(f"MF: {customer.get('tax_id')}", normal_style))
        
        elements.append(Spacer(1, 15*mm))
        
        # Montant
        amount = payment.get("amount", 0)
        currency = payment.get("currency", "TND")
        
        amount_box_data = [
            [Paragraph("MONTANT REÇU", ParagraphStyle('AmountLabel', parent=styles['Normal'], fontSize=12, alignment=TA_CENTER))],
            [Paragraph(f"{amount:,.3f} {currency}", amount_style)]
        ]
        
        amount_table = Table(amount_box_data, colWidths=[160*mm])
        amount_table.setStyle(TableStyle([
            ('BOX', (0, 0), (-1, -1), 2, colors.HexColor('#6B46C1')),
            ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor('#F3E8FF')),
            ('TOPPADDING', (0, 0), (-1, -1), 15),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 15),
            ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
        ]))
        elements.append(amount_table)
        
        elements.append(Spacer(1, 10*mm))
        
        # Montant en lettres
        amount_in_words = self._number_to_words(amount, currency)
        elements.append(Paragraph(f"<b>Arrêté le présent reçu à la somme de:</b>", normal_style))
        elements.append(Paragraph(f"<i>{amount_in_words}</i>", normal_style))
        
        elements.append(Spacer(1, 15*mm))
        
        # Notes
        if payment.get("notes"):
            elements.append(Paragraph("Notes:", header_style))
            elements.append(Paragraph(payment.get("notes"), normal_style))
            elements.append(Spacer(1, 10*mm))
        
        # Signature
        elements.append(Spacer(1, 20*mm))
        
        signature_data = [
            ["", "Signature et cachet"],
            ["", ""],
            ["", ""],
            ["", "_" * 30]
        ]
        
        signature_table = Table(signature_data, colWidths=[100*mm, 60*mm])
        signature_table.setStyle(TableStyle([
            ('ALIGN', (1, 0), (1, -1), 'CENTER'),
            ('FONTSIZE', (0, 0), (-1, -1), 10),
        ]))
        elements.append(signature_table)
        
        # Footer
        elements.append(Spacer(1, 20*mm))
        footer_style = ParagraphStyle(
            'Footer',
            parent=styles['Normal'],
            fontSize=8,
            alignment=TA_CENTER,
            textColor=colors.grey
        )
        elements.append(Paragraph(f"Document généré le {datetime.now().strftime('%d/%m/%Y à %H:%M')}", footer_style))
        elements.append(Paragraph("Ce reçu fait foi de paiement - Conservez-le précieusement", footer_style))
        
        # Construire le PDF
        doc.build(elements)
        
        return buffer.getvalue()
    
    def _get_payment_method_label(self, method: str) -> str:
        """Retourne le libellé du mode de paiement"""
        labels = {
            "cash": "Espèces",
            "check": "Chèque",
            "bank_transfer": "Virement bancaire",
            "credit_card": "Carte bancaire",
            "mobile_payment": "Paiement mobile",
            "other": "Autre"
        }
        return labels.get(method, method)
    
    def _number_to_words(self, number: float, currency: str = "TND") -> str:
        """Convertit un nombre en lettres (français)"""
        
        units = ["", "un", "deux", "trois", "quatre", "cinq", "six", "sept", "huit", "neuf",
                 "dix", "onze", "douze", "treize", "quatorze", "quinze", "seize", "dix-sept",
                 "dix-huit", "dix-neuf"]
        tens = ["", "", "vingt", "trente", "quarante", "cinquante", "soixante",
                "soixante", "quatre-vingt", "quatre-vingt"]
        
        def convert_less_than_thousand(n):
            if n == 0:
                return ""
            elif n < 20:
                return units[n]
            elif n < 100:
                ten = n // 10
                unit = n % 10
                if ten == 7 or ten == 9:
                    unit += 10
                    ten -= 1
                if unit == 0:
                    if ten == 8:
                        return "quatre-vingts"
                    return tens[ten]
                elif unit == 1 and ten != 8:
                    return f"{tens[ten]} et {units[unit]}"
                else:
                    return f"{tens[ten]}-{units[unit]}"
            else:
                hundred = n // 100
                rest = n % 100
                if hundred == 1:
                    if rest == 0:
                        return "cent"
                    return f"cent {convert_less_than_thousand(rest)}"
                else:
                    if rest == 0:
                        return f"{units[hundred]} cents"
                    return f"{units[hundred]} cent {convert_less_than_thousand(rest)}"
        
        def convert(n):
            if n == 0:
                return "zéro"
            
            result = ""
            
            # Millions
            if n >= 1000000:
                millions = n // 1000000
                n %= 1000000
                if millions == 1:
                    result += "un million "
                else:
                    result += f"{convert_less_than_thousand(millions)} millions "
            
            # Milliers
            if n >= 1000:
                thousands = n // 1000
                n %= 1000
                if thousands == 1:
                    result += "mille "
                else:
                    result += f"{convert_less_than_thousand(thousands)} mille "
            
            # Reste
            if n > 0:
                result += convert_less_than_thousand(n)
            
            return result.strip()
        
        # Séparer partie entière et décimale
        integer_part = int(number)
        decimal_part = round((number - integer_part) * 1000)
        
        currency_names = {
            "TND": ("dinar", "dinars", "millime", "millimes"),
            "EUR": ("euro", "euros", "centime", "centimes"),
            "USD": ("dollar", "dollars", "cent", "cents")
        }
        
        curr = currency_names.get(currency, ("unité", "unités", "fraction", "fractions"))
        
        result = convert(integer_part)
        result += f" {curr[1] if integer_part > 1 else curr[0]}"
        
        if decimal_part > 0:
            result += f" et {convert(decimal_part)} {curr[3] if decimal_part > 1 else curr[2]}"
        
        return result.capitalize()
    
    async def generate_supplier_payment_receipt(
        self,
        payment_id: str,
        company_id: str
    ) -> bytes:
        """
        Génère un reçu PDF pour un paiement fournisseur
        """
        from bson import ObjectId
        from reportlab.lib import colors
        from reportlab.lib.pagesizes import A4
        from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
        from reportlab.lib.units import mm
        from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
        from reportlab.lib.enums import TA_CENTER
        
        # Récupérer les données du paiement fournisseur
        payment = await self.db.supplier_payments.find_one({
            "_id": ObjectId(payment_id),
            "company_id": ObjectId(company_id)
        })
        
        if not payment:
            raise ValueError("Paiement fournisseur non trouvé")
        
        # Récupérer les données de l'entreprise
        company = await self.db.companies.find_one({"_id": ObjectId(company_id)})
        
        # Récupérer les données du fournisseur
        supplier = None
        if payment.get("supplier_id"):
            supplier = await self.db.suppliers.find_one({"_id": payment["supplier_id"]})
        
        # Créer le PDF (similaire au reçu client mais adapté)
        buffer = BytesIO()
        doc = SimpleDocTemplate(
            buffer,
            pagesize=A4,
            rightMargin=20*mm,
            leftMargin=20*mm,
            topMargin=20*mm,
            bottomMargin=20*mm
        )
        
        styles = getSampleStyleSheet()
        
        title_style = ParagraphStyle(
            'Title',
            parent=styles['Heading1'],
            fontSize=24,
            alignment=TA_CENTER,
            spaceAfter=20,
            textColor=colors.HexColor('#E53E3E')  # Rouge pour les dépenses
        )
        
        elements = []
        
        company_name = company.get("name", "EasyBill") if company else "EasyBill"
        elements.append(Paragraph(company_name, title_style))
        elements.append(Spacer(1, 10*mm))
        elements.append(Paragraph("ORDRE DE PAIEMENT", title_style))
        
        # ... (contenu similaire adapté pour les paiements fournisseurs)
        
        doc.build(elements)
        return buffer.getvalue()
