from fastapi import APIRouter, HTTPException, status, Depends, Query, Request
from motor.motor_asyncio import AsyncIOMotorClient
from bson import ObjectId
from datetime import datetime, timezone
import os
from typing import Optional
from models.product import Product, ProductCreate, ProductUpdate
from utils.dependencies import get_current_user, get_current_company

router = APIRouter(prefix="/api/products", tags=["Products"])

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]


def serialize_product(p: dict) -> dict:
    """Serialize product document for JSON response."""
    return {
        "id": str(p["_id"]),
        "name": p.get("name"),
        "sku": p.get("sku"),
        "description": p.get("description"),
        "type": p.get("type", "product"),
        "category": p.get("category"),
        "brand": p.get("brand"),
        "unit": p.get("unit", "pièce"),
        "selling_price": p.get("selling_price", 0),
        "purchase_price": p.get("purchase_price", 0),
        "tax_id": str(p.get("tax_id")) if p.get("tax_id") else None,
        "tax_rate": p.get("tax_rate", 19),
        "quantity_in_stock": p.get("quantity_in_stock", 0),
        "min_stock_level": p.get("min_stock_level", 0),
        "warehouse_id": str(p.get("warehouse_id")) if p.get("warehouse_id") else None,
        "destination": p.get("destination", "both"),
        "reference_type": p.get("reference_type", "disabled"),
        "quantity_type": p.get("quantity_type", "simple"),
        "barcode": p.get("barcode"),
        "is_composite": p.get("is_composite", False),
        "components": p.get("components", []),
        "total_sold": p.get("total_sold", 0),
        "is_active": p.get("is_active", True),
        "created_at": p["created_at"].isoformat() if p.get("created_at") else None,
        "updated_at": p["updated_at"].isoformat() if p.get("updated_at") else None
    }


async def log_product_action(company_id, user_id, user_name, action, element, ip_address=None):
    """Log product action."""
    await db.access_logs.insert_one({
        "company_id": ObjectId(company_id),
        "user_id": ObjectId(user_id),
        "user_name": user_name,
        "category": "Article",
        "action": action,
        "element": element,
        "ip_address": ip_address,
        "created_at": datetime.now(timezone.utc)
    })


@router.post("/", status_code=status.HTTP_201_CREATED)
async def create_product(
    product_data: ProductCreate,
    request: Request,
    company_id: str = Query(...),
    current_user: dict = Depends(get_current_user)
):
    company = await get_current_company(current_user, company_id)
    
    product_dict = product_data.dict(exclude_unset=True)
    product_dict.update({
        "company_id": ObjectId(company_id),
        "quantity_in_stock": product_dict.get("quantity_in_stock", 0),
        "is_active": True,
        "created_at": datetime.now(timezone.utc),
        "updated_at": datetime.now(timezone.utc)
    })
    
    result = await db.products.insert_one(product_dict)
    
    await log_product_action(
        company_id, str(current_user["_id"]), current_user.get("full_name", ""),
        "Créer", product_data.name, request.client.host if request.client else None
    )
    
    return {"id": str(result.inserted_id), "message": "Product created successfully"}


@router.get("/")
async def list_products(
    company_id: str = Query(...),
    search: Optional[str] = None,
    category: Optional[str] = None,
    type: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    company = await get_current_company(current_user, company_id)
    
    query = {"company_id": ObjectId(company_id)}
    if search:
        query["$or"] = [
            {"name": {"$regex": search, "$options": "i"}},
            {"sku": {"$regex": search, "$options": "i"}},
            {"description": {"$regex": search, "$options": "i"}}
        ]
    if category:
        query["category"] = category
    if type:
        query["type"] = type
    
    products = await db.products.find(query).to_list(1000)
    return [serialize_product(p) for p in products]


@router.get("/{product_id}")
async def get_product(
    product_id: str,
    company_id: str = Query(...),
    current_user: dict = Depends(get_current_user)
):
    company = await get_current_company(current_user, company_id)
    
    product = await db.products.find_one({
        "_id": ObjectId(product_id),
        "company_id": ObjectId(company_id)
    })
    
    if not product:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Product not found")
    
    return serialize_product(product)


@router.put("/{product_id}")
async def update_product(
    product_id: str,
    product_update: ProductUpdate,
    request: Request,
    company_id: str = Query(...),
    current_user: dict = Depends(get_current_user)
):
    company = await get_current_company(current_user, company_id)
    
    product = await db.products.find_one({"_id": ObjectId(product_id)})
    
    update_data = {k: v for k, v in product_update.dict(exclude_unset=True).items()}
    update_data["updated_at"] = datetime.now(timezone.utc)
    
    result = await db.products.update_one(
        {"_id": ObjectId(product_id), "company_id": ObjectId(company_id)},
        {"$set": update_data}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Product not found")
    
    await log_product_action(
        company_id, str(current_user["_id"]), current_user.get("full_name", ""),
        "Mise à jour", product.get("name", ""), request.client.host if request.client else None
    )
    
    return {"message": "Product updated successfully"}


@router.delete("/{product_id}")
async def delete_product(
    product_id: str,
    request: Request,
    company_id: str = Query(...),
    current_user: dict = Depends(get_current_user)
):
    company = await get_current_company(current_user, company_id)
    
    product = await db.products.find_one({"_id": ObjectId(product_id)})
    if not product:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Product not found")
    
    result = await db.products.delete_one({
        "_id": ObjectId(product_id),
        "company_id": ObjectId(company_id)
    })
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Product not found")
    
    await log_product_action(
        company_id, str(current_user["_id"]), current_user.get("full_name", ""),
        "Supprimer", product.get("name", ""), request.client.host if request.client else None
    )
    
    return {"message": "Product deleted successfully"}


# Stock movements
@router.post("/{product_id}/stock-movement")
async def create_stock_movement(
    product_id: str,
    request: Request,
    company_id: str = Query(...),
    quantity: float = Query(...),
    movement_type: str = Query(...),  # "in" or "out"
    reason: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    company = await get_current_company(current_user, company_id)
    
    product = await db.products.find_one({
        "_id": ObjectId(product_id),
        "company_id": ObjectId(company_id)
    })
    
    if not product:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Product not found")
    
    current_stock = product.get("quantity_in_stock", 0)
    if movement_type == "in":
        new_stock = current_stock + quantity
    else:
        if current_stock < quantity:
            raise HTTPException(status_code=400, detail="Stock insuffisant")
        new_stock = current_stock - quantity
    
    # Update product stock
    await db.products.update_one(
        {"_id": ObjectId(product_id)},
        {"$set": {"quantity_in_stock": new_stock, "updated_at": datetime.now(timezone.utc)}}
    )
    
    # Log movement
    movement = {
        "product_id": ObjectId(product_id),
        "company_id": ObjectId(company_id),
        "type": movement_type,
        "quantity": quantity,
        "previous_stock": current_stock,
        "new_stock": new_stock,
        "reason": reason,
        "created_by": current_user["_id"],
        "created_at": datetime.now(timezone.utc)
    }
    await db.stock_movements.insert_one(movement)
    
    await log_product_action(
        company_id, str(current_user["_id"]), current_user.get("full_name", ""),
        "Mouvement stock", f"{product.get('name')} ({'+' if movement_type == 'in' else '-'}{quantity})",
        request.client.host if request.client else None
    )
    
    return {"message": "Stock movement recorded", "new_stock": new_stock}


@router.get("/{product_id}/stock-movements")
async def get_stock_movements(
    product_id: str,
    company_id: str = Query(...),
    current_user: dict = Depends(get_current_user)
):
    company = await get_current_company(current_user, company_id)
    
    movements = await db.stock_movements.find({
        "product_id": ObjectId(product_id),
        "company_id": ObjectId(company_id)
    }).sort("created_at", -1).to_list(100)
    
    return [{
        "id": str(m["_id"]),
        "type": m["type"],
        "quantity": m["quantity"],
        "previous_stock": m["previous_stock"],
        "new_stock": m["new_stock"],
        "reason": m.get("reason"),
        "created_at": m["created_at"].isoformat()
    } for m in movements]


@router.get("/export/template")
async def get_import_template(
    company_id: str = Query(...),
    current_user: dict = Depends(get_current_user)
):
    """Get Excel import template for products."""
    from fastapi.responses import Response
    import io
    
    company = await get_current_company(current_user, company_id)
    
    # Create CSV template content
    headers = [
        "reference", "titre", "description", "categorie", "marque", "unite",
        "prix_vente_ht", "prix_achat_ht", "taux_tva", "quantite_stock",
        "stock_minimum", "code_barre", "type_article", "destination"
    ]
    
    example_row = [
        "REF-001", "Exemple Article", "Description de l'article", "Informatique", "Dell",
        "pièce", "100.000", "80.000", "19", "50", "10", "123456789", "product", "both"
    ]
    
    csv_content = ";".join(headers) + "\n" + ";".join(example_row) + "\n"
    
    return Response(
        content=csv_content,
        media_type="text/csv",
        headers={
            "Content-Disposition": "attachment; filename=modele_import_articles.csv"
        }
    )


@router.post("/import")
async def import_products(
    request: Request,
    company_id: str = Query(...),
    current_user: dict = Depends(get_current_user)
):
    """Import products from CSV/Excel file."""
    
    company = await get_current_company(current_user, company_id)
    
    form = await request.form()
    file = form.get("file")
    delimiter = form.get("delimiter", ";") or ";"
    encoding = form.get("encoding", "utf-8") or "utf-8"
    
    if not file:
        raise HTTPException(status_code=400, detail="Fichier requis")
    
    content = await file.read()
    
    # Try different encodings
    try:
        content_str = content.decode(encoding)
    except UnicodeDecodeError:
        try:
            content_str = content.decode('utf-8-sig')
        except UnicodeDecodeError:
            content_str = content.decode('latin-1')
    
    # Remove BOM if present
    if content_str.startswith('\ufeff'):
        content_str = content_str[1:]
    
    lines = content_str.strip().split('\n')
    if len(lines) < 2:
        raise HTTPException(status_code=400, detail="Fichier vide ou format invalide")
    
    headers = [h.strip().lower() for h in lines[0].split(delimiter)]
    
    imported_count = 0
    errors = []
    now = datetime.now(timezone.utc)
    
    for i, line in enumerate(lines[1:], start=2):
        if not line.strip():
            continue
            
        try:
            values = [v.strip() for v in line.split(delimiter)]
            row_data = dict(zip(headers, values))
            
            product_doc = {
                "sku": row_data.get("reference", ""),
                "name": row_data.get("titre", row_data.get("name", "")),
                "description": row_data.get("description", ""),
                "category": row_data.get("categorie", row_data.get("category", "")),
                "brand": row_data.get("marque", row_data.get("brand", "")),
                "unit": row_data.get("unite", row_data.get("unit", "pièce")),
                "selling_price": float(row_data.get("prix_vente_ht", row_data.get("selling_price", 0)) or 0),
                "purchase_price": float(row_data.get("prix_achat_ht", row_data.get("purchase_price", 0)) or 0),
                "tax_rate": float(row_data.get("taux_tva", row_data.get("tax_rate", 19)) or 19),
                "quantity_in_stock": int(float(row_data.get("quantite_stock", row_data.get("quantity", 0)) or 0)),
                "min_stock_level": int(float(row_data.get("stock_minimum", row_data.get("min_stock", 0)) or 0)),
                "barcode": row_data.get("code_barre", row_data.get("barcode", "")),
                "type": row_data.get("type_article", row_data.get("type", "product")),
                "destination": row_data.get("destination", "both"),
                "company_id": ObjectId(company_id),
                "is_active": True,
                "created_at": now,
                "updated_at": now
            }
            
            if not product_doc["name"]:
                errors.append(f"Ligne {i}: Titre manquant")
                continue
            
            await db.products.insert_one(product_doc)
            imported_count += 1
            
        except Exception as e:
            errors.append(f"Ligne {i}: {str(e)}")
    
    await log_product_action(
        company_id, str(current_user["_id"]), current_user.get("full_name", ""),
        "Import", f"{imported_count} articles importés",
        request.client.host if request.client else None
    )
    
    return {
        "message": f"{imported_count} articles importés avec succès",
        "imported": imported_count,
        "errors": errors[:10]  # Return first 10 errors only
    }


@router.get("/export/stock")
async def export_stock_state(
    company_id: str = Query(...),
    current_user: dict = Depends(get_current_user)
):
    """Export current stock state as CSV."""
    from fastapi.responses import Response
    
    company = await get_current_company(current_user, company_id)
    
    products = await db.products.find({"company_id": ObjectId(company_id)}).to_list(10000)
    
    headers = ["Reference", "Titre", "Categorie", "Unite", "Stock Actuel", "Stock Minimum", "Prix Achat", "Valeur Stock"]
    csv_lines = [";".join(headers)]
    
    for p in products:
        stock = p.get("quantity_in_stock", 0)
        purchase_price = p.get("purchase_price", 0)
        row = [
            p.get("sku", ""),
            p.get("name", ""),
            p.get("category", ""),
            p.get("unit", "pièce"),
            str(stock),
            str(p.get("min_stock_level", 0)),
            f"{purchase_price:.3f}",
            f"{stock * purchase_price:.3f}"
        ]
        csv_lines.append(";".join(row))
    
    csv_content = "\n".join(csv_lines)
    
    return Response(
        content=csv_content,
        media_type="text/csv",
        headers={
            "Content-Disposition": "attachment; filename=etat_stock.csv"
        }
    )


@router.get("/export/prices")
async def export_price_list(
    company_id: str = Query(...),
    current_user: dict = Depends(get_current_user)
):
    """Export price list as CSV."""
    from fastapi.responses import Response
    
    company = await get_current_company(current_user, company_id)
    
    products = await db.products.find({"company_id": ObjectId(company_id)}).to_list(10000)
    
    headers = ["Reference", "Titre", "Categorie", "Prix Vente HT", "Prix Achat HT", "TVA %", "Prix Vente TTC"]
    csv_lines = [";".join(headers)]
    
    for p in products:
        selling_price = p.get("selling_price", 0)
        tax_rate = p.get("tax_rate", 19)
        ttc = selling_price * (1 + tax_rate / 100)
        row = [
            p.get("sku", ""),
            p.get("name", ""),
            p.get("category", ""),
            f"{selling_price:.3f}",
            f"{p.get('purchase_price', 0):.3f}",
            str(tax_rate),
            f"{ttc:.3f}"
        ]
        csv_lines.append(";".join(row))
    
    csv_content = "\n".join(csv_lines)
    
    return Response(
        content=csv_content,
        media_type="text/csv",
        headers={
            "Content-Disposition": "attachment; filename=liste_prix.csv"
        }
    )


@router.delete("/bulk/delete")
async def bulk_delete_products(
    request: Request,
    company_id: str = Query(...),
    current_user: dict = Depends(get_current_user)
):
    """Delete multiple products."""
    company = await get_current_company(current_user, company_id)
    
    body = await request.json()
    product_ids = body.get("product_ids", [])
    
    if not product_ids:
        raise HTTPException(status_code=400, detail="Aucun article sélectionné")
    
    object_ids = [ObjectId(pid) for pid in product_ids]
    
    result = await db.products.delete_many({
        "_id": {"$in": object_ids},
        "company_id": ObjectId(company_id)
    })
    
    await log_product_action(
        company_id, str(current_user["_id"]), current_user.get("full_name", ""),
        "Supprimer (lot)", f"{result.deleted_count} articles supprimés",
        request.client.host if request.client else None
    )
    
    return {"message": f"{result.deleted_count} articles supprimés"}


@router.delete("/bulk/delete-all")
async def delete_all_products(
    request: Request,
    company_id: str = Query(...),
    current_user: dict = Depends(get_current_user)
):
    """Delete all products for a company."""
    company = await get_current_company(current_user, company_id)
    
    result = await db.products.delete_many({"company_id": ObjectId(company_id)})
    
    await log_product_action(
        company_id, str(current_user["_id"]), current_user.get("full_name", ""),
        "Supprimer tout", f"Tous les articles ({result.deleted_count})",
        request.client.host if request.client else None
    )
    
    return {"message": f"Tous les articles supprimés ({result.deleted_count})"}

