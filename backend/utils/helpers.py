import secrets
import string

def generate_document_number(prefix: str, next_number: int, year: int = None) -> str:
    """
    Generate document number with format: PREFIX-YYYY-NNNNN or PREFIX-NNNNN (5 digits)
    """
    if year:
        return f"{prefix}-{year}-{next_number:05d}"
    return f"{prefix}-{next_number:05d}"

def generate_random_token(length: int = 32) -> str:
    """
    Generate random token for verification, password reset, etc.
    """
    alphabet = string.ascii_letters + string.digits
    return ''.join(secrets.choice(alphabet) for _ in range(length))

def calculate_document_totals(items: list) -> dict:
    """
    Calculate subtotal, tax, discount and total from document items
    """
    subtotal = 0.0
    total_tax = 0.0
    total_discount = 0.0
    
    for item in items:
        item_subtotal = item['quantity'] * item['unit_price']
        item_discount = item_subtotal * (item.get('discount', 0) / 100)
        item_after_discount = item_subtotal - item_discount
        item_tax = item_after_discount * (item.get('tax_rate', 0) / 100)
        
        subtotal += item_subtotal
        total_discount += item_discount
        total_tax += item_tax
        
        # Update item total
        item['total'] = item_after_discount + item_tax
    
    total = subtotal - total_discount + total_tax
    
    return {
        'subtotal': round(subtotal, 2),
        'total_tax': round(total_tax, 2),
        'total_discount': round(total_discount, 2),
        'total': round(total, 2)
    }