"""
PDF Generation Service for EasyBill
Uses ReportLab (pure Python, no system dependencies).
"""
import io
from datetime import datetime
from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.lib.units import cm
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import (
    SimpleDocTemplate, Table, TableStyle, Paragraph,
    Spacer, HRFlowable
)
from reportlab.lib.enums import TA_RIGHT, TA_CENTER, TA_LEFT

# ─────────────────────────────────────────────
VIOLET = colors.HexColor('#7C3AED')
GRAY   = colors.HexColor('#6B7280')
LIGHT  = colors.HexColor('#F3F4F6')
WHITE  = colors.white
BLACK  = colors.HexColor('#111827')

def _fmt_date(val):
    if not val:
        return ''
    if isinstance(val, datetime):
        return val.strftime('%d/%m/%Y')
    try:
        return datetime.fromisoformat(str(val).replace('Z', '+00:00')).strftime('%d/%m/%Y')
    except Exception:
        return str(val)[:10]

def _str(val):
    """Safely convert any value (including dict/None) to a plain string."""
    if val is None:
        return ''
    if isinstance(val, dict):
        # Try common address dict keys
        parts = [val.get('street') or val.get('line1') or val.get('address', ''),
                 val.get('city', ''), val.get('postal_code') or val.get('zip', '')]
        return ', '.join(str(p) for p in parts if p)
    return str(val)

def _fmt_num(val, decimals=3):
    try:
        return f"{float(val):,.{decimals}f}".replace(',', ' ')
    except Exception:
        return '0.000'

def _styles():
    base = getSampleStyleSheet()
    return {
        'title':   ParagraphStyle('title',   fontSize=20, textColor=VIOLET, fontName='Helvetica-Bold'),
        'h2':      ParagraphStyle('h2',       fontSize=11, textColor=BLACK,  fontName='Helvetica-Bold'),
        'normal':  ParagraphStyle('normal',   fontSize=9,  textColor=BLACK,  fontName='Helvetica', leading=12),
        'small':   ParagraphStyle('small',    fontSize=8,  textColor=GRAY,   fontName='Helvetica'),
        'right':   ParagraphStyle('right',    fontSize=9,  textColor=BLACK,  fontName='Helvetica', alignment=TA_RIGHT),
        'bold':    ParagraphStyle('bold',     fontSize=9,  textColor=BLACK,  fontName='Helvetica-Bold'),
        'total':   ParagraphStyle('total',    fontSize=11, textColor=VIOLET, fontName='Helvetica-Bold', alignment=TA_RIGHT),
    }

def _header_section(s, company, customer, doc_label, doc_number, doc_date, extra_label='', extra_date=''):
    """Build header: company info left, customer right, doc info."""
    elements = []
    # Company + Doc title
    col1 = [
        Paragraph(_str(company.get('name', '')), s['title']),
        Spacer(1, 4),
        Paragraph(_str(company.get('address', '')), s['small']),
        Paragraph(_str(company.get('city', '')), s['small']),
        Paragraph(f"Tél : {_str(company.get('phone'))}" if company.get('phone') else '', s['small']),
        Paragraph(f"Email : {_str(company.get('email'))}" if company.get('email') else '', s['small']),
        Paragraph(f"MF : {_str(company.get('tax_id'))}" if company.get('tax_id') else '', s['small']),
    ]
    cust_name = _str(customer.get('display_name') or customer.get('name', ''))
    col2 = [
        Paragraph(f"<b>{doc_label}</b>", s['h2']),
        Paragraph(f"N° {_str(doc_number)}", s['bold']),
        Paragraph(f"Date : {_str(doc_date)}", s['normal']),
        Paragraph(f"{extra_label} : {_str(extra_date)}" if extra_label and extra_date else '', s['normal']),
        Spacer(1, 12),
        Paragraph('<b>Destinataire</b>', s['bold']),
        Paragraph(cust_name, s['bold']),
        Paragraph(_str(customer.get('address', '')), s['small']),
        Paragraph(_str(customer.get('city', '')), s['small']),
        Paragraph(f"MF : {_str(customer.get('tax_id'))}" if customer.get('tax_id') else '', s['small']),
    ]
    tbl = Table([[col1, col2]], colWidths=[9*cm, 9*cm])
    tbl.setStyle(TableStyle([
        ('VALIGN', (0,0), (-1,-1), 'TOP'),
        ('LEFTPADDING', (0,0), (-1,-1), 0),
        ('RIGHTPADDING', (0,0), (-1,-1), 0),
    ]))
    elements.append(tbl)
    elements.append(Spacer(1, 14))
    elements.append(HRFlowable(width='100%', thickness=1, color=VIOLET))
    elements.append(Spacer(1, 10))
    return elements

def _items_table(s, items):
    """Build items table."""
    header = ['#', 'Description', 'Qté', 'P.U. HT', 'Taxe', 'Total HT']
    rows = [header]
    for i, item in enumerate(items, 1):
        desc = _str(item.get('description') or item.get('product_name') or '')
        qty  = _fmt_num(item.get('quantity', 1), 2)
        pu   = _fmt_num(item.get('unit_price', 0))
        tax  = f"{float(item.get('tax_rate', 0) or 0):.0f}%"
        tot  = _fmt_num(item.get('total', 0))
        rows.append([str(i), desc, qty, pu, tax, tot])

    col_widths = [0.7*cm, 8*cm, 1.8*cm, 2.5*cm, 1.5*cm, 2.5*cm]
    tbl = Table(rows, colWidths=col_widths, repeatRows=1)
    style = TableStyle([
        # Header
        ('BACKGROUND',    (0,0), (-1,0), VIOLET),
        ('TEXTCOLOR',     (0,0), (-1,0), WHITE),
        ('FONTNAME',      (0,0), (-1,0), 'Helvetica-Bold'),
        ('FONTSIZE',      (0,0), (-1,0), 8),
        ('ALIGN',         (0,0), (-1,0), 'CENTER'),
        # Body
        ('FONTNAME',      (0,1), (-1,-1), 'Helvetica'),
        ('FONTSIZE',      (0,1), (-1,-1), 8),
        ('ROWBACKGROUNDS',(0,1), (-1,-1), [WHITE, LIGHT]),
        ('ALIGN',         (2,1), (-1,-1), 'RIGHT'),
        ('VALIGN',        (0,0), (-1,-1), 'MIDDLE'),
        ('TOPPADDING',    (0,0), (-1,-1), 5),
        ('BOTTOMPADDING', (0,0), (-1,-1), 5),
        ('LEFTPADDING',   (0,0), (-1,-1), 5),
        ('GRID',          (0,0), (-1,-1), 0.3, colors.HexColor('#E5E7EB')),
    ])
    tbl.setStyle(style)
    return tbl

def _bank_footer_section(s, bank_accounts):
    """Build bank details section for invoice footer."""
    if not bank_accounts:
        return []
    rows = []
    for acc in bank_accounts:
        name = _str(acc.get("bank_name"))
        rib = _str(acc.get("rib"))
        if not name and not rib:
            continue
        if name and rib:
            rows.append(Paragraph(f"<b>{name}</b> — RIB : {rib}", s['small']))
        elif name:
            rows.append(Paragraph(f"<b>{name}</b>", s['small']))
        else:
            rows.append(Paragraph(f"RIB : {rib}", s['small']))
    if not rows:
        return []
    return [
        Spacer(1, 14),
        HRFlowable(width='100%', thickness=0.5, color=GRAY),
        Spacer(1, 6),
        Paragraph('<b>Coordonnées bancaires</b>', s['bold']),
        Spacer(1, 4),
    ] + rows


def _totals_section(s, subtotal, total_discount, total_tax, fiscal_stamp, total):
    """Right-aligned totals block."""
    rows = []
    rows.append(['Sous-total HT', f"{_fmt_num(subtotal)} TND"])
    if float(total_discount or 0) > 0:
        rows.append(['Remise', f"- {_fmt_num(total_discount)} TND"])
    rows.append(['TVA', f"{_fmt_num(total_tax)} TND"])
    if float(fiscal_stamp or 0) > 0:
        rows.append(['Timbre fiscal', f"{_fmt_num(fiscal_stamp)} TND"])
    tbl = Table(rows, colWidths=[5*cm, 3*cm], hAlign='RIGHT')
    tbl.setStyle(TableStyle([
        ('FONTNAME',      (0,0), (-1,-1), 'Helvetica'),
        ('FONTSIZE',      (0,0), (-1,-1), 9),
        ('ALIGN',         (1,0), (1,-1), 'RIGHT'),
        ('TOPPADDING',    (0,0), (-1,-1), 3),
        ('BOTTOMPADDING', (0,0), (-1,-1), 3),
        ('LINEABOVE',     (0,0), (-1,0),  0.5, GRAY),
    ]))
    total_row = Table([[Paragraph('Total TTC', s['bold']), Paragraph(f"{_fmt_num(total)} TND", s['total'])]], colWidths=[5*cm, 3*cm], hAlign='RIGHT')
    total_row.setStyle(TableStyle([
        ('BACKGROUND',    (0,0), (-1,-1), VIOLET),
        ('TEXTCOLOR',     (0,0), (-1,-1), WHITE),
        ('TOPPADDING',    (0,0), (-1,-1), 6),
        ('BOTTOMPADDING', (0,0), (-1,-1), 6),
        ('LEFTPADDING',   (0,0), (-1,-1), 8),
        ('RIGHTPADDING',  (0,0), (-1,-1), 8),
        ('ROUNDEDCORNERS',(0,0), (-1,-1), 4),
    ]))
    return [tbl, Spacer(1, 4), total_row]

def _build_pdf(elements):
    buf = io.BytesIO()
    doc = SimpleDocTemplate(
        buf, pagesize=A4,
        leftMargin=1.5*cm, rightMargin=1.5*cm,
        topMargin=1.5*cm, bottomMargin=2*cm
    )
    doc.build(elements)
    return buf.getvalue()


# ═════════════════════════════════════════════
# PUBLIC API
# ═════════════════════════════════════════════

def generate_quote_pdf(quote, company, customer):
    s = _styles()
    el = []
    el += _header_section(
        s, company, customer,
        'DEVIS', quote.get('number', ''),
        _fmt_date(quote.get('date')),
        'Valable jusqu\'au', _fmt_date(quote.get('valid_until'))
    )
    el.append(_items_table(s, quote.get('items', [])))
    el.append(Spacer(1, 12))
    el += _totals_section(
        s,
        quote.get('subtotal', 0),
        quote.get('total_discount', 0),
        quote.get('total_tax', 0),
        quote.get('fiscal_stamp', 0),
        quote.get('total', 0),
    )
    if quote.get('notes'):
        el += [Spacer(1, 14), HRFlowable(width='100%', thickness=0.5, color=GRAY),
               Spacer(1, 6), Paragraph('<b>Notes</b>', s['bold']),
               Paragraph(quote['notes'], s['normal'])]
    return _build_pdf(el)


def generate_invoice_pdf(invoice, company, customer):
    s = _styles()
    el = []
    el += _header_section(
        s, company, customer,
        'FACTURE', invoice.get('number', ''),
        _fmt_date(invoice.get('date')),
        'Échéance', _fmt_date(invoice.get('due_date'))
    )
    el.append(_items_table(s, invoice.get('items', [])))
    el.append(Spacer(1, 12))
    el += _totals_section(
        s,
        invoice.get('subtotal', 0),
        invoice.get('total_discount', 0),
        invoice.get('total_tax', 0),
        invoice.get('fiscal_stamp', 0),
        invoice.get('total', 0),
    )
    if invoice.get('show_bank_details', True) and company.get('bank_accounts'):
        el += _bank_footer_section(s, company['bank_accounts'])
    if invoice.get('notes'):
        el += [Spacer(1, 14), HRFlowable(width='100%', thickness=0.5, color=GRAY),
               Spacer(1, 6), Paragraph('<b>Notes</b>', s['bold']),
               Paragraph(invoice['notes'], s['normal'])]
    return _build_pdf(el)


def generate_delivery_note_pdf(delivery_note, company, customer):
    s = _styles()
    el = []
    el += _header_section(
        s, company, customer,
        'BON DE LIVRAISON', delivery_note.get('number', ''),
        _fmt_date(delivery_note.get('date')),
    )
    el.append(_items_table(s, delivery_note.get('items', [])))
    if delivery_note.get('notes'):
        el += [Spacer(1, 14), HRFlowable(width='100%', thickness=0.5, color=GRAY),
               Spacer(1, 6), Paragraph('<b>Notes</b>', s['bold']),
               Paragraph(delivery_note['notes'], s['normal'])]
    return _build_pdf(el)
