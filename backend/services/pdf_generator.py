"""
PDF Generation Service for EasyBill
Generates professional PDFs for invoices, quotes, delivery notes, etc.
Uses WeasyPrint for HTML to PDF conversion.
"""
import io
import os
from datetime import datetime
from weasyprint import HTML, CSS
from weasyprint.text.fonts import FontConfiguration

# Base CSS for all documents
BASE_CSS = """
@page {
    size: A4;
    margin: 1.5cm;
    @bottom-center {
        content: "Page " counter(page) " / " counter(pages);
        font-size: 9px;
        color: #666;
    }
}

* {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
}

body {
    font-family: 'Helvetica Neue', Arial, sans-serif;
    font-size: 11px;
    line-height: 1.5;
    color: #333;
}

.document {
    padding: 0;
}

/* Header */
.header {
    display: flex;
    justify-content: space-between;
    margin-bottom: 30px;
    padding-bottom: 20px;
    border-bottom: 3px solid #7C3AED;
}

.company-info {
    max-width: 50%;
}

.company-name {
    font-size: 24px;
    font-weight: bold;
    color: #7C3AED;
    margin-bottom: 5px;
}

.company-details {
    font-size: 10px;
    color: #666;
    line-height: 1.6;
}

.document-info {
    text-align: right;
}

.document-type {
    font-size: 22px;
    font-weight: bold;
    color: #1F2937;
    margin-bottom: 10px;
}

.document-number {
    font-size: 14px;
    color: #7C3AED;
    font-weight: 600;
    margin-bottom: 5px;
}

.document-date {
    font-size: 11px;
    color: #666;
}

/* Client Section */
.client-section {
    display: flex;
    justify-content: space-between;
    margin-bottom: 30px;
}

.client-box {
    background: #F9FAFB;
    padding: 15px;
    border-radius: 8px;
    width: 48%;
}

.client-box-title {
    font-size: 10px;
    text-transform: uppercase;
    color: #6B7280;
    margin-bottom: 8px;
    font-weight: 600;
}

.client-name {
    font-size: 14px;
    font-weight: 600;
    color: #1F2937;
    margin-bottom: 5px;
}

.client-details {
    font-size: 10px;
    color: #6B7280;
    line-height: 1.6;
}

/* Items Table */
.items-table {
    width: 100%;
    border-collapse: collapse;
    margin-bottom: 30px;
}

.items-table th {
    background: #7C3AED;
    color: white;
    padding: 12px 10px;
    text-align: left;
    font-size: 10px;
    text-transform: uppercase;
    font-weight: 600;
}

.items-table th:last-child,
.items-table td:last-child {
    text-align: right;
}

.items-table th:nth-child(2),
.items-table td:nth-child(2),
.items-table th:nth-child(3),
.items-table td:nth-child(3),
.items-table th:nth-child(4),
.items-table td:nth-child(4) {
    text-align: center;
}

.items-table td {
    padding: 12px 10px;
    border-bottom: 1px solid #E5E7EB;
    font-size: 10px;
}

.items-table tr:nth-child(even) {
    background: #F9FAFB;
}

.item-description {
    font-weight: 500;
    color: #1F2937;
}

.item-note {
    font-size: 9px;
    color: #6B7280;
    margin-top: 3px;
}

/* Totals */
.totals-section {
    display: flex;
    justify-content: flex-end;
    margin-bottom: 30px;
}

.totals-table {
    width: 300px;
}

.totals-row {
    display: flex;
    justify-content: space-between;
    padding: 8px 0;
    border-bottom: 1px solid #E5E7EB;
}

.totals-row.total {
    border-bottom: none;
    border-top: 2px solid #7C3AED;
    margin-top: 5px;
    padding-top: 12px;
}

.totals-label {
    color: #6B7280;
    font-size: 11px;
}

.totals-value {
    font-weight: 600;
    color: #1F2937;
    font-size: 11px;
}

.totals-row.total .totals-label,
.totals-row.total .totals-value {
    font-size: 14px;
    font-weight: bold;
    color: #7C3AED;
}

/* Fiscal Stamp */
.fiscal-stamp {
    background: #FEF3C7;
    border: 1px solid #F59E0B;
    padding: 10px 15px;
    border-radius: 6px;
    display: inline-block;
    margin-bottom: 20px;
}

.fiscal-stamp-label {
    font-size: 9px;
    color: #92400E;
    text-transform: uppercase;
}

.fiscal-stamp-value {
    font-size: 12px;
    font-weight: bold;
    color: #92400E;
}

/* Notes & Conditions */
.notes-section {
    margin-bottom: 30px;
}

.notes-title {
    font-size: 11px;
    font-weight: 600;
    color: #1F2937;
    margin-bottom: 8px;
}

.notes-content {
    font-size: 10px;
    color: #6B7280;
    background: #F9FAFB;
    padding: 12px;
    border-radius: 6px;
    line-height: 1.6;
}

/* Payment Info */
.payment-section {
    background: #EDE9FE;
    padding: 15px;
    border-radius: 8px;
    margin-bottom: 30px;
}

.payment-title {
    font-size: 11px;
    font-weight: 600;
    color: #5B21B6;
    margin-bottom: 10px;
}

.payment-details {
    font-size: 10px;
    color: #6B7280;
}

.payment-details strong {
    color: #5B21B6;
}

/* Footer */
.footer {
    margin-top: 40px;
    padding-top: 20px;
    border-top: 1px solid #E5E7EB;
    text-align: center;
    font-size: 9px;
    color: #9CA3AF;
}

/* Status Badge */
.status-badge {
    display: inline-block;
    padding: 4px 12px;
    border-radius: 20px;
    font-size: 10px;
    font-weight: 600;
    text-transform: uppercase;
}

.status-draft { background: #FEF3C7; color: #92400E; }
.status-sent { background: #DBEAFE; color: #1E40AF; }
.status-paid { background: #D1FAE5; color: #065F46; }
.status-overdue { background: #FEE2E2; color: #991B1B; }
.status-accepted { background: #D1FAE5; color: #065F46; }
.status-rejected { background: #FEE2E2; color: #991B1B; }

/* Amount in words */
.amount-words {
    font-style: italic;
    font-size: 10px;
    color: #6B7280;
    margin-top: 5px;
}
"""


def format_currency(amount, currency="TND"):
    """Format amount as Tunisian currency"""
    if amount is None:
        amount = 0
    return f"{amount:,.3f} {currency}"


def format_date(date_str, format_type="long"):
    """Format date string"""
    if not date_str:
        return ""
    try:
        if isinstance(date_str, str):
            date_obj = datetime.fromisoformat(date_str.replace('Z', '+00:00'))
        else:
            date_obj = date_str
        
        if format_type == "long":
            return date_obj.strftime("%d %B %Y")
        return date_obj.strftime("%d/%m/%Y")
    except:
        return str(date_str)


def number_to_words_fr(n):
    """Convert number to French words (simplified)"""
    if n == 0:
        return "zéro"
    
    units = ["", "un", "deux", "trois", "quatre", "cinq", "six", "sept", "huit", "neuf",
             "dix", "onze", "douze", "treize", "quatorze", "quinze", "seize", "dix-sept", "dix-huit", "dix-neuf"]
    tens = ["", "", "vingt", "trente", "quarante", "cinquante", "soixante", "soixante", "quatre-vingt", "quatre-vingt"]
    
    def convert_chunk(num):
        if num < 20:
            return units[num]
        elif num < 100:
            t, u = divmod(num, 10)
            if t == 7 or t == 9:
                return tens[t] + "-" + units[10 + u]
            elif u == 0:
                return tens[t] + ("s" if t == 8 else "")
            elif u == 1 and t != 8:
                return tens[t] + " et un"
            else:
                return tens[t] + "-" + units[u]
        elif num < 1000:
            h, r = divmod(num, 100)
            if h == 1:
                prefix = "cent"
            else:
                prefix = units[h] + " cent"
            if r == 0:
                return prefix + ("s" if h > 1 else "")
            return prefix + " " + convert_chunk(r)
        elif num < 1000000:
            t, r = divmod(num, 1000)
            if t == 1:
                prefix = "mille"
            else:
                prefix = convert_chunk(t) + " mille"
            if r == 0:
                return prefix
            return prefix + " " + convert_chunk(r)
        else:
            return str(num)
    
    integer_part = int(n)
    decimal_part = int(round((n - integer_part) * 1000))
    
    result = convert_chunk(integer_part) + " dinars"
    if decimal_part > 0:
        result += " et " + convert_chunk(decimal_part) + " millimes"
    
    return result.capitalize()


def generate_invoice_html(invoice: dict, company: dict, customer: dict) -> str:
    """Generate HTML for invoice"""
    items_html = ""
    for item in invoice.get("items", []):
        qty = item.get("quantity", 1)
        price = item.get("unit_price", 0)
        discount = item.get("discount", 0)
        tax = item.get("tax_rate", 0)
        total = item.get("total", qty * price)
        
        items_html += f"""
        <tr>
            <td>
                <div class="item-description">{item.get('description', '')}</div>
                {f'<div class="item-note">{item.get("note", "")}</div>' if item.get('note') else ''}
            </td>
            <td>{qty}</td>
            <td>{format_currency(price)}</td>
            <td>{discount}%</td>
            <td>{tax}%</td>
            <td>{format_currency(total)}</td>
        </tr>
        """
    
    status_class = f"status-{invoice.get('status', 'draft')}"
    status_label = {
        'draft': 'Brouillon',
        'sent': 'Envoyée',
        'paid': 'Payée',
        'partial': 'Partielle',
        'overdue': 'En retard',
        'cancelled': 'Annulée'
    }.get(invoice.get('status', 'draft'), invoice.get('status', ''))
    
    fiscal_stamp = invoice.get('fiscal_stamp', 0)
    fiscal_stamp_html = ""
    if fiscal_stamp > 0:
        fiscal_stamp_html = f"""
        <div class="fiscal-stamp">
            <span class="fiscal-stamp-label">Timbre fiscal</span>
            <span class="fiscal-stamp-value">{format_currency(fiscal_stamp)}</span>
        </div>
        """
    
    total = invoice.get('total', 0)
    amount_words = number_to_words_fr(total)
    
    html = f"""
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <title>Facture {invoice.get('number', '')}</title>
    </head>
    <body>
        <div class="document">
            <div class="header">
                <div class="company-info">
                    <div class="company-name">{company.get('name', 'EasyBill')}</div>
                    <div class="company-details">
                        {company.get('address', '')}<br>
                        {company.get('city', '')} {company.get('postal_code', '')}<br>
                        Tél: {company.get('phone', '')} | Email: {company.get('email', '')}<br>
                        MF: {company.get('tax_id', '')}
                    </div>
                </div>
                <div class="document-info">
                    <div class="document-type">FACTURE</div>
                    <div class="document-number">{invoice.get('number', '')}</div>
                    <div class="document-date">{format_date(invoice.get('date'))}</div>
                    <div style="margin-top: 10px;">
                        <span class="status-badge {status_class}">{status_label}</span>
                    </div>
                </div>
            </div>
            
            <div class="client-section">
                <div class="client-box">
                    <div class="client-box-title">Facturer à</div>
                    <div class="client-name">{customer.get('display_name', customer.get('name', ''))}</div>
                    <div class="client-details">
                        {customer.get('address', '')}<br>
                        {customer.get('city', '')} {customer.get('postal_code', '')}<br>
                        {f"MF: {customer.get('tax_id', '')}" if customer.get('tax_id') else ''}
                    </div>
                </div>
                <div class="client-box">
                    <div class="client-box-title">Échéance</div>
                    <div class="client-name">{format_date(invoice.get('due_date'))}</div>
                    <div class="client-details">
                        Conditions: {invoice.get('payment_terms', 'À réception')}
                    </div>
                </div>
            </div>
            
            <table class="items-table">
                <thead>
                    <tr>
                        <th style="width: 40%;">Description</th>
                        <th style="width: 10%;">Qté</th>
                        <th style="width: 15%;">Prix unit.</th>
                        <th style="width: 10%;">Remise</th>
                        <th style="width: 10%;">TVA</th>
                        <th style="width: 15%;">Total</th>
                    </tr>
                </thead>
                <tbody>
                    {items_html}
                </tbody>
            </table>
            
            <div class="totals-section">
                <div class="totals-table">
                    <div class="totals-row">
                        <span class="totals-label">Sous-total HT</span>
                        <span class="totals-value">{format_currency(invoice.get('subtotal', 0))}</span>
                    </div>
                    <div class="totals-row">
                        <span class="totals-label">Remise totale</span>
                        <span class="totals-value">-{format_currency(invoice.get('total_discount', 0))}</span>
                    </div>
                    <div class="totals-row">
                        <span class="totals-label">TVA</span>
                        <span class="totals-value">{format_currency(invoice.get('total_tax', 0))}</span>
                    </div>
                    {f'<div class="totals-row"><span class="totals-label">Timbre fiscal</span><span class="totals-value">{format_currency(fiscal_stamp)}</span></div>' if fiscal_stamp > 0 else ''}
                    <div class="totals-row total">
                        <span class="totals-label">TOTAL TTC</span>
                        <span class="totals-value">{format_currency(total)}</span>
                    </div>
                </div>
            </div>
            
            <div class="amount-words">
                Arrêtée la présente facture à la somme de: <strong>{amount_words}</strong>
            </div>
            
            {fiscal_stamp_html}
            
            {f'<div class="notes-section"><div class="notes-title">Notes</div><div class="notes-content">{invoice.get("notes", "")}</div></div>' if invoice.get('notes') else ''}
            
            <div class="payment-section">
                <div class="payment-title">Informations de paiement</div>
                <div class="payment-details">
                    <strong>Banque:</strong> {company.get('bank_name', 'N/A')}<br>
                    <strong>RIB:</strong> {company.get('bank_rib', 'N/A')}<br>
                    <strong>IBAN:</strong> {company.get('bank_iban', 'N/A')}
                </div>
            </div>
            
            <div class="footer">
                {company.get('name', 'EasyBill')} - {company.get('legal_form', '')} au capital de {company.get('capital', '0')} TND<br>
                RC: {company.get('rc_number', '')} | MF: {company.get('tax_id', '')}
            </div>
        </div>
    </body>
    </html>
    """
    return html


def generate_quote_html(quote: dict, company: dict, customer: dict) -> str:
    """Generate HTML for quote"""
    items_html = ""
    for item in quote.get("items", []):
        qty = item.get("quantity", 1)
        price = item.get("unit_price", 0)
        discount = item.get("discount", 0)
        tax = item.get("tax_rate", 0)
        total = item.get("total", qty * price)
        
        items_html += f"""
        <tr>
            <td>
                <div class="item-description">{item.get('description', '')}</div>
                {f'<div class="item-note">{item.get("note", "")}</div>' if item.get('note') else ''}
            </td>
            <td>{qty}</td>
            <td>{format_currency(price)}</td>
            <td>{discount}%</td>
            <td>{tax}%</td>
            <td>{format_currency(total)}</td>
        </tr>
        """
    
    status_class = f"status-{quote.get('status', 'draft')}"
    status_label = {
        'draft': 'Brouillon',
        'sent': 'Envoyé',
        'accepted': 'Accepté',
        'rejected': 'Refusé',
        'expired': 'Expiré',
        'converted': 'Converti'
    }.get(quote.get('status', 'draft'), quote.get('status', ''))
    
    total = quote.get('total', 0)
    amount_words = number_to_words_fr(total)
    
    html = f"""
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <title>Devis {quote.get('number', '')}</title>
    </head>
    <body>
        <div class="document">
            <div class="header">
                <div class="company-info">
                    <div class="company-name">{company.get('name', 'EasyBill')}</div>
                    <div class="company-details">
                        {company.get('address', '')}<br>
                        {company.get('city', '')} {company.get('postal_code', '')}<br>
                        Tél: {company.get('phone', '')} | Email: {company.get('email', '')}<br>
                        MF: {company.get('tax_id', '')}
                    </div>
                </div>
                <div class="document-info">
                    <div class="document-type">DEVIS</div>
                    <div class="document-number">{quote.get('number', '')}</div>
                    <div class="document-date">{format_date(quote.get('date'))}</div>
                    <div style="margin-top: 10px;">
                        <span class="status-badge {status_class}">{status_label}</span>
                    </div>
                </div>
            </div>
            
            <div class="client-section">
                <div class="client-box">
                    <div class="client-box-title">Client</div>
                    <div class="client-name">{customer.get('display_name', customer.get('name', ''))}</div>
                    <div class="client-details">
                        {customer.get('address', '')}<br>
                        {customer.get('city', '')} {customer.get('postal_code', '')}<br>
                        {f"MF: {customer.get('tax_id', '')}" if customer.get('tax_id') else ''}
                    </div>
                </div>
                <div class="client-box">
                    <div class="client-box-title">Validité</div>
                    <div class="client-name">{format_date(quote.get('valid_until'))}</div>
                    <div class="client-details">
                        Ce devis est valable jusqu'à la date indiquée
                    </div>
                </div>
            </div>
            
            <table class="items-table">
                <thead>
                    <tr>
                        <th style="width: 40%;">Description</th>
                        <th style="width: 10%;">Qté</th>
                        <th style="width: 15%;">Prix unit.</th>
                        <th style="width: 10%;">Remise</th>
                        <th style="width: 10%;">TVA</th>
                        <th style="width: 15%;">Total</th>
                    </tr>
                </thead>
                <tbody>
                    {items_html}
                </tbody>
            </table>
            
            <div class="totals-section">
                <div class="totals-table">
                    <div class="totals-row">
                        <span class="totals-label">Sous-total HT</span>
                        <span class="totals-value">{format_currency(quote.get('subtotal', 0))}</span>
                    </div>
                    <div class="totals-row">
                        <span class="totals-label">Remise totale</span>
                        <span class="totals-value">-{format_currency(quote.get('total_discount', 0))}</span>
                    </div>
                    <div class="totals-row">
                        <span class="totals-label">TVA</span>
                        <span class="totals-value">{format_currency(quote.get('total_tax', 0))}</span>
                    </div>
                    <div class="totals-row total">
                        <span class="totals-label">TOTAL TTC</span>
                        <span class="totals-value">{format_currency(total)}</span>
                    </div>
                </div>
            </div>
            
            <div class="amount-words">
                Arrêté le présent devis à la somme de: <strong>{amount_words}</strong>
            </div>
            
            {f'<div class="notes-section"><div class="notes-title">Notes et conditions</div><div class="notes-content">{quote.get("notes", "")}</div></div>' if quote.get('notes') else ''}
            
            <div class="notes-section">
                <div class="notes-title">Conditions générales</div>
                <div class="notes-content">
                    - Ce devis est valable pour une durée de 30 jours à compter de sa date d'émission.<br>
                    - Toute modification entraînera l'établissement d'un nouveau devis.<br>
                    - Un acompte de 30% sera demandé à la commande.
                </div>
            </div>
            
            <div class="footer">
                {company.get('name', 'EasyBill')} - {company.get('legal_form', '')} au capital de {company.get('capital', '0')} TND<br>
                RC: {company.get('rc_number', '')} | MF: {company.get('tax_id', '')}
            </div>
        </div>
    </body>
    </html>
    """
    return html


def generate_delivery_note_html(delivery: dict, company: dict, customer: dict) -> str:
    """Generate HTML for delivery note"""
    items_html = ""
    for item in delivery.get("items", []):
        items_html += f"""
        <tr>
            <td>
                <div class="item-description">{item.get('description', '')}</div>
            </td>
            <td>{item.get('quantity', 1)}</td>
            <td>{item.get('unit', 'Unité')}</td>
        </tr>
        """
    
    status_class = "status-paid" if delivery.get('status') == 'delivered' else "status-draft"
    status_label = "Livré" if delivery.get('status') == 'delivered' else "En attente"
    
    html = f"""
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <title>Bon de livraison {delivery.get('number', '')}</title>
    </head>
    <body>
        <div class="document">
            <div class="header">
                <div class="company-info">
                    <div class="company-name">{company.get('name', 'EasyBill')}</div>
                    <div class="company-details">
                        {company.get('address', '')}<br>
                        {company.get('city', '')} {company.get('postal_code', '')}<br>
                        Tél: {company.get('phone', '')}
                    </div>
                </div>
                <div class="document-info">
                    <div class="document-type">BON DE LIVRAISON</div>
                    <div class="document-number">{delivery.get('number', '')}</div>
                    <div class="document-date">{format_date(delivery.get('date'))}</div>
                    <div style="margin-top: 10px;">
                        <span class="status-badge {status_class}">{status_label}</span>
                    </div>
                </div>
            </div>
            
            <div class="client-section">
                <div class="client-box">
                    <div class="client-box-title">Destinataire</div>
                    <div class="client-name">{customer.get('display_name', customer.get('name', ''))}</div>
                    <div class="client-details">
                        {delivery.get('shipping_address', customer.get('address', ''))}<br>
                        {customer.get('city', '')} {customer.get('postal_code', '')}
                    </div>
                </div>
                <div class="client-box">
                    <div class="client-box-title">Livreur</div>
                    <div class="client-name">{delivery.get('delivery_person', 'N/A')}</div>
                    <div class="client-details">
                        {f"Livré le: {format_date(delivery.get('delivered_at'))}" if delivery.get('delivered_at') else ''}
                    </div>
                </div>
            </div>
            
            <table class="items-table">
                <thead>
                    <tr>
                        <th style="width: 70%;">Description</th>
                        <th style="width: 15%;">Quantité</th>
                        <th style="width: 15%;">Unité</th>
                    </tr>
                </thead>
                <tbody>
                    {items_html}
                </tbody>
            </table>
            
            {f'<div class="notes-section"><div class="notes-title">Notes</div><div class="notes-content">{delivery.get("notes", "")}</div></div>' if delivery.get('notes') else ''}
            
            <div style="margin-top: 50px; display: flex; justify-content: space-between;">
                <div style="width: 45%; text-align: center;">
                    <div style="border-top: 1px solid #000; padding-top: 10px; margin-top: 60px;">
                        Signature du livreur
                    </div>
                </div>
                <div style="width: 45%; text-align: center;">
                    <div style="border-top: 1px solid #000; padding-top: 10px; margin-top: 60px;">
                        Signature du client
                    </div>
                </div>
            </div>
            
            <div class="footer">
                {company.get('name', 'EasyBill')} - {company.get('tax_id', '')}
            </div>
        </div>
    </body>
    </html>
    """
    return html


def generate_pdf(html_content: str) -> bytes:
    """Convert HTML to PDF bytes"""
    font_config = FontConfiguration()
    html = HTML(string=html_content)
    css = CSS(string=BASE_CSS, font_config=font_config)
    
    pdf_bytes = html.write_pdf(stylesheets=[css], font_config=font_config)
    return pdf_bytes


def generate_invoice_pdf(invoice: dict, company: dict, customer: dict) -> bytes:
    """Generate invoice PDF"""
    html = generate_invoice_html(invoice, company, customer)
    return generate_pdf(html)


def generate_quote_pdf(quote: dict, company: dict, customer: dict) -> bytes:
    """Generate quote PDF"""
    html = generate_quote_html(quote, company, customer)
    return generate_pdf(html)


def generate_delivery_note_pdf(delivery: dict, company: dict, customer: dict) -> bytes:
    """Generate delivery note PDF"""
    html = generate_delivery_note_html(delivery, company, customer)
    return generate_pdf(html)
