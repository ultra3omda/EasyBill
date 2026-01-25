#!/usr/bin/env python3
"""
Script pour ajouter les hooks de synchronisation comptable
aux routes supplier_invoices, supplier_payments, stock_movements, credit_notes
"""

import sys
import os

# Ajouter le répertoire parent au path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Fichiers à modifier
files_to_modify = [
    ("routes/supplier_invoices.py", "sync_supplier_invoice", "supplier_invoice"),
    ("routes/supplier_payments.py", "sync_supplier_payment", "supplier_payment"),
    ("routes/stock_movements.py", "sync_stock_movement", "stock_movement"),
    ("routes/credit_notes.py", "sync_credit_note", "credit_note")
]

def add_imports(filepath):
    """Ajoute les imports nécessaires"""
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # Vérifier si déjà importé
    if "from services.accounting_sync_service import accounting_sync_service" in content:
        print(f"✓ {filepath}: Imports déjà présents")
        return content
    
    # Ajouter logging si absent
    if "import logging" not in content:
        content = content.replace("import os", "import os\nimport logging")
    
    # Ajouter l'import du service
    if "from utils.dependencies" in content:
        content = content.replace(
            "from utils.dependencies",
            "from services.accounting_sync_service import accounting_sync_service\nfrom utils.dependencies"
        )
    
    # Ajouter le logger après les imports
    if "logger = logging.getLogger(__name__)" not in content:
        # Trouver la ligne router = APIRouter
        if "router = APIRouter" in content:
            content = content.replace(
                "router = APIRouter",
                "logger = logging.getLogger(__name__)\n\nrouter = APIRouter"
            )
    
    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(content)
    
    print(f"✓ {filepath}: Imports ajoutés")
    return content

def add_hook_to_create(filepath, sync_method, doc_type):
    """Ajoute le hook de synchronisation après la création"""
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # Vérifier si le hook existe déjà
    if f"accounting_sync_service.{sync_method}" in content:
        print(f"✓ {filepath}: Hook déjà présent")
        return content
    
    # Patterns à rechercher pour l'insertion
    patterns = [
        'return {"id": str(result.inserted_id)',
        'return {"message":',
        'return {\'id\': str(result.inserted_id)',
        'return {\'message\':'
    ]
    
    hook_code = f"""
    # Synchronisation comptable automatique
    try:
        await accounting_sync_service.{sync_method}(str(result.inserted_id))
    except Exception as e:
        logger.error(f"Erreur synchronisation comptable {doc_type} {{result.inserted_id}}: {{str(e)}}")
    
"""
    
    modified = False
    for pattern in patterns:
        if pattern in content and f"accounting_sync_service.{sync_method}" not in content:
            # Trouver toutes les occurrences
            lines = content.split('\n')
            new_lines = []
            for i, line in enumerate(lines):
                new_lines.append(line)
                if pattern in line and i > 0:
                    # Vérifier qu'on est dans une fonction async def create
                    # en remontant les lignes
                    is_create_function = False
                    for j in range(max(0, i-30), i):
                        if 'async def create' in lines[j] or 'async def record' in lines[j]:
                            is_create_function = True
                            break
                    
                    if is_create_function:
                        # Insérer le hook avant le return
                        indent = len(line) - len(line.lstrip())
                        hook_lines = hook_code.strip().split('\n')
                        for hook_line in hook_lines:
                            new_lines.insert(-1, ' ' * indent + hook_line)
                        modified = True
                        break
            
            if modified:
                content = '\n'.join(new_lines)
                break
    
    if modified:
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)
        print(f"✓ {filepath}: Hook de création ajouté")
    else:
        print(f"⚠ {filepath}: Pattern de création non trouvé")
    
    return content

def add_hook_to_update(filepath, sync_method, doc_type):
    """Ajoute le hook de synchronisation après la mise à jour (changement de statut)"""
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # Pour supplier_invoices et credit_notes, ajouter hook sur changement de statut
    if 'supplier_invoice' in doc_type or 'credit_note' in doc_type:
        if 'status' in content and 'validated' in content:
            # Chercher l'endpoint update
            if 'async def update' in content:
                hook_code = f"""
    # Synchronisation comptable automatique si changement de statut vers validated
    old_status = existing.get("status")
    new_status = update_data.get("status")
    if new_status == "validated" and old_status != new_status:
        try:
            await accounting_sync_service.{sync_method}({doc_type}_id)
        except Exception as e:
            logger.error(f"Erreur synchronisation comptable {doc_type} {{{doc_type}_id}}: {{str(e)}}")
    
"""
                # Chercher le return après l'update
                if 'return {"message":' in content or "return {'message':" in content:
                    lines = content.split('\n')
                    new_lines = []
                    for i, line in enumerate(lines):
                        new_lines.append(line)
                        if ('return {"message":' in line or "return {'message':" in line):
                            # Vérifier qu'on est dans update
                            is_update_function = False
                            for j in range(max(0, i-40), i):
                                if 'async def update' in lines[j]:
                                    is_update_function = True
                                    break
                            
                            if is_update_function and f"accounting_sync_service.{sync_method}" not in '\n'.join(lines[max(0,i-20):i]):
                                # Insérer le hook avant le return
                                indent = len(line) - len(line.lstrip())
                                hook_lines = hook_code.strip().split('\n')
                                for hook_line in hook_lines:
                                    new_lines.insert(-1, ' ' * indent + hook_line)
                                break
                    
                    content = '\n'.join(new_lines)
                    with open(filepath, 'w', encoding='utf-8') as f:
                        f.write(content)
                    print(f"✓ {filepath}: Hook de mise à jour ajouté")
                    return content
    
    print(f"⚠ {filepath}: Hook de mise à jour non applicable ou déjà présent")
    return content

def main():
    print("🔧 Ajout des hooks de synchronisation comptable...\n")
    
    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    
    for filepath, sync_method, doc_type in files_to_modify:
        full_path = os.path.join(base_dir, filepath)
        
        if not os.path.exists(full_path):
            print(f"✗ {filepath}: Fichier non trouvé")
            continue
        
        print(f"\n📝 Traitement de {filepath}...")
        
        # Ajouter les imports
        add_imports(full_path)
        
        # Ajouter le hook de création
        add_hook_to_create(full_path, sync_method, doc_type)
        
        # Ajouter le hook de mise à jour si applicable
        add_hook_to_update(full_path, sync_method, doc_type)
    
    print("\n✅ Hooks de synchronisation comptable ajoutés avec succès!")
    print("\n📋 Résumé:")
    print("   - supplier_invoices.py: sync_supplier_invoice()")
    print("   - supplier_payments.py: sync_supplier_payment()")
    print("   - stock_movements.py: sync_stock_movement()")
    print("   - credit_notes.py: sync_credit_note()")

if __name__ == "__main__":
    main()
