# backend/routes/products.py
# CRUD for products, product categories, and formula builder
# Auto-calculates cost price from formula lines

from flask import Blueprint, request, jsonify, send_file, current_app
from middleware.auth import require_auth
from config import supabase
from services.cost_calculator import recalculate_product_cost, recalculate_formulation_cost
from services.inventory_ledger import log_stock_change
from services.pdf_generator import generate_formula_pdf
from services.semantic_search import upsert_product_to_pinecone, delete_product_from_pinecone
import io
import csv

products_bp = Blueprint("products", __name__)


def _response(data=None, error=None, status=200):
    return jsonify({"data": data, "error": error}), status


# ═══════════════════════════════════════════════════════════════════════
# PRODUCT CATEGORIES
# ═══════════════════════════════════════════════════════════════════════

@products_bp.route("/categories", methods=["GET"])
@require_auth
def list_categories():
    try:
        resp = supabase.table("product_categories") \
            .select("*") \
            .order("name") \
            .execute()
        return _response(data=resp.data)
    except Exception as e:
        current_app.logger.error("failed to list product categories: %s", e)
        return _response(error=str(e), status=500)


@products_bp.route("/categories", methods=["POST"])
@require_auth
def create_category():
    try:
        body = request.get_json()
        resp = supabase.table("product_categories") \
            .insert({"name": body["name"]}) \
            .execute()
        user_email = getattr(getattr(request, 'user', None), 'email', 'unknown')
        new_id = resp.data[0]["id"] if resp.data else "unknown"
        current_app.logger.info("user %s created product category %s", user_email, new_id)
        return _response(data=resp.data[0] if resp.data else None, status=201)
    except Exception as e:
        current_app.logger.error("failed to create product category: %s", e)
        return _response(error=str(e), status=400)


@products_bp.route("/categories/<cat_id>", methods=["DELETE"])
@require_auth
def delete_category(cat_id):
    try:
        supabase.table("product_categories").delete().eq("id", cat_id).execute()
        user_email = getattr(getattr(request, 'user', None), 'email', 'unknown')
        current_app.logger.info("user %s deleted product category %s", user_email, cat_id)
        return _response(data={"deleted": cat_id})
    except Exception as e:
        current_app.logger.error("failed to delete product category %s: %s", cat_id, e)
        return _response(error=str(e), status=400)


# ═══════════════════════════════════════════════════════════════════════
# PRODUCTS
# ═══════════════════════════════════════════════════════════════════════

@products_bp.route("", methods=["GET"])
@require_auth
def list_products():
    try:
        query = supabase.table("products") \
            .select("*, product_categories(name)") \
            .order("name")

        search = request.args.get("search", "").strip()
        if search:
            query = query.ilike("name", f"%{search}%")

        category = request.args.get("category_id", "").strip()
        if category:
            query = query.eq("category_id", category)

        resp = query.execute()
        return _response(data=resp.data)
    except Exception as e:
        current_app.logger.error("failed to list products: %s", e)
        return _response(error=str(e), status=500)


@products_bp.route("/<product_id>", methods=["GET"])
@require_auth
def get_product(product_id):
    try:
        resp = supabase.table("products") \
            .select("*, product_categories(name)") \
            .eq("id", product_id) \
            .single() \
            .execute()
        return _response(data=resp.data)
    except Exception as e:
        current_app.logger.error("failed to get product %s: %s", product_id, e)
        return _response(error=str(e), status=404)


@products_bp.route("", methods=["POST"])
@require_auth
def create_product():
    try:
        body = request.get_json()
        row = {
            "name": body["name"],
            "category_id": body.get("category_id"),
            "description": body.get("description", ""),
            "batch_size": body.get("batch_size"),
            "batch_unit": body.get("batch_unit"),
            "formulation_id": body.get("formulation_id"),
            "fill_volume": body.get("fill_volume"),
            "wholesale_price": body.get("wholesale_price", 0),
            "retail_price": body.get("retail_price", 0),
            "wholesale_min_qty": body.get("wholesale_min_qty", 1),
            "selling_price": body.get("selling_price", 0),
            "cost_price": body.get("cost_price", 0),
            "stock_qty": body.get("stock_qty", 0),
            "low_stock_threshold": body.get("low_stock_threshold", 0),
            "supplier_name": body.get("supplier_name", ""),
            "supplier_number": body.get("supplier_number", ""),
            "selling_unit": body.get("selling_unit", ""),
            "packaging_size": body.get("packaging_size"),
            "packaging_unit": body.get("packaging_unit", ""),
        }
        resp = supabase.table("products").insert(row).execute()
        
        # Auto-calculate cost if linked to a formulation
        if row.get("formulation_id"):
            recalculate_formulation_cost(row["formulation_id"])
            # Refetch the product to get the updated cost_price
            resp = supabase.table("products").select("*").eq("id", resp.data[0]["id"]).execute()
            
        user_email = getattr(getattr(request, 'user', None), 'email', 'unknown')
        new_id = resp.data[0]["id"] if resp.data else "unknown"
        current_app.logger.info("user %s created product %s", user_email, new_id)
        
        # Sync to Pinecone
        if resp.data:
            upsert_product_to_pinecone(new_id, body["name"])
            
        return _response(data=resp.data[0] if resp.data else None, status=201)
    except Exception as e:
        current_app.logger.error("failed to create product: %s", e)
        return _response(error=str(e), status=400)


@products_bp.route("/<product_id>", methods=["PUT"])
@require_auth
def update_product(product_id):
    try:
        body = request.get_json()
        
        # Fetch current record to check for stock changes
        current = supabase.table("products") \
            .select("stock_qty") \
            .eq("id", product_id) \
            .single() \
            .execute()
        old_stock = float(current.data.get("stock_qty") or 0)

        update_fields = {}
        for field in ["name", "category_id", "description", "batch_size",
                       "batch_unit", "selling_price", "cost_price", "stock_qty", "low_stock_threshold",
                       "formulation_id", "fill_volume", "wholesale_price", "retail_price", "wholesale_min_qty",
                       "supplier_name", "supplier_number",
                       "selling_unit", "packaging_size", "packaging_unit"]:
            if field in body:
                update_fields[field] = body[field]

        resp = supabase.table("products") \
            .update(update_fields) \
            .eq("id", product_id) \
            .execute()
            
        if "stock_qty" in body:
            new_stock = float(body["stock_qty"])
            if new_stock != old_stock:
                log_stock_change(
                    "product", product_id, new_stock - old_stock, new_stock, 
                    "manual_edit", "Manual edit via Products page"
                )
            
        # Recalculate cost if formulation link or fill volume changed
        if "formulation_id" in update_fields or "fill_volume" in update_fields:
            if update_fields.get("formulation_id"):
                recalculate_formulation_cost(update_fields["formulation_id"])
                resp = supabase.table("products").select("*").eq("id", product_id).execute()

        user_email = getattr(getattr(request, 'user', None), 'email', 'unknown')
        current_app.logger.info("user %s updated product %s", user_email, product_id)
        
        # Sync to Pinecone if name changed
        if "name" in update_fields:
            upsert_product_to_pinecone(product_id, update_fields["name"])
            
        return _response(data=resp.data[0] if resp.data else None)
    except Exception as e:
        current_app.logger.error("failed to update product %s: %s", product_id, e)
        return _response(error=str(e), status=400)


@products_bp.route("/<product_id>", methods=["DELETE"])
@require_auth
def delete_product(product_id):
    try:
        supabase.table("products").delete().eq("id", product_id).execute()
        user_email = getattr(getattr(request, 'user', None), 'email', 'unknown')
        current_app.logger.info("user %s deleted product %s", user_email, product_id)
        
        # Sync to Pinecone
        delete_product_from_pinecone(product_id)
        
        return _response(data={"deleted": product_id})
    except Exception as e:
        current_app.logger.error("failed to delete product %s: %s", product_id, e)
        return _response(error=str(e), status=400)


# ═══════════════════════════════════════════════════════════════════════
# FORMULA BUILDER
# ═══════════════════════════════════════════════════════════════════════

@products_bp.route("/<product_id>/formula", methods=["GET"])
@require_auth
def get_formula(product_id):
    """Get all formula lines for a product, with raw material details."""
    try:
        resp = supabase.table("product_formula") \
            .select("*, raw_materials(id, name, unit, price_per_unit)") \
            .eq("product_id", product_id) \
            .execute()
        return _response(data=resp.data)
    except Exception as e:
        current_app.logger.error("failed to get formula for product %s: %s", product_id, e)
        return _response(error=str(e), status=500)


@products_bp.route("/<product_id>/formula", methods=["POST"])
@require_auth
def add_formula_line(product_id):
    """Add a raw material line to a product's formula, then recalculate cost."""
    try:
        body = request.get_json()
        row = {
            "product_id": product_id,
            "raw_material_id": body["raw_material_id"],
            "qty_per_batch": body["qty_per_batch"],
        }
        resp = supabase.table("product_formula").insert(row).execute()

        # Recalculate the product's cost price
        new_cost = recalculate_product_cost(product_id)

        result = resp.data[0] if resp.data else {}
        result["new_cost_price"] = new_cost
        user_email = getattr(getattr(request, 'user', None), 'email', 'unknown')
        current_app.logger.info("user %s added formula line to product %s", user_email, product_id)
        return _response(data=result, status=201)
    except Exception as e:
        current_app.logger.error("failed to add formula line to product %s: %s", product_id, e)
        return _response(error=str(e), status=400)


@products_bp.route("/<product_id>/formula/<line_id>", methods=["PUT"])
@require_auth
def update_formula_line(product_id, line_id):
    """Update a formula line's quantity, then recalculate cost."""
    try:
        body = request.get_json()
        update_fields = {}
        if "raw_material_id" in body:
            update_fields["raw_material_id"] = body["raw_material_id"]
        if "qty_per_batch" in body:
            update_fields["qty_per_batch"] = body["qty_per_batch"]

        supabase.table("product_formula") \
            .update(update_fields) \
            .eq("id", line_id) \
            .execute()

        new_cost = recalculate_product_cost(product_id)
        user_email = getattr(getattr(request, 'user', None), 'email', 'unknown')
        current_app.logger.info("user %s updated formula line %s on product %s", user_email, line_id, product_id)
        return _response(data={"updated": line_id, "new_cost_price": new_cost})
    except Exception as e:
        current_app.logger.error("failed to update formula line %s on product %s: %s", line_id, product_id, e)
        return _response(error=str(e), status=400)


@products_bp.route("/<product_id>/formula/<line_id>", methods=["DELETE"])
@require_auth
def delete_formula_line(product_id, line_id):
    """Remove a formula line and recalculate cost."""
    try:
        supabase.table("product_formula").delete().eq("id", line_id).execute()
        new_cost = recalculate_product_cost(product_id)
        user_email = getattr(getattr(request, 'user', None), 'email', 'unknown')
        current_app.logger.info("user %s deleted formula line %s from product %s", user_email, line_id, product_id)
        return _response(data={"deleted": line_id, "new_cost_price": new_cost})
    except Exception as e:
        current_app.logger.error("failed to delete formula line %s from product %s: %s", line_id, product_id, e)
        return _response(error=str(e), status=400)


@products_bp.route("/<product_id>/formula/bulk", methods=["PUT"])
@require_auth
def bulk_update_formula(product_id):
    """
    Replace the entire formula for a product.
    Expects: { "lines": [{"raw_material_id": "...", "qty_per_batch": ...}, ...] }
    """
    try:
        body = request.get_json()
        lines = body.get("lines", [])

        # Delete existing formula lines
        supabase.table("product_formula") \
            .delete() \
            .eq("product_id", product_id) \
            .execute()

        # Insert new formula lines
        if lines:
            rows = [
                {
                    "product_id": product_id,
                    "raw_material_id": line["raw_material_id"],
                    "qty_per_batch": line["qty_per_batch"],
                }
                for line in lines
            ]
            supabase.table("product_formula").insert(rows).execute()

        # Recalculate cost
        new_cost = recalculate_product_cost(product_id)
        user_email = getattr(getattr(request, 'user', None), 'email', 'unknown')
        current_app.logger.info("user %s bulk-updated formula for product %s (%d lines)", user_email, product_id, len(lines))
        return _response(data={"new_cost_price": new_cost, "lines_count": len(lines)})
    except Exception as e:
        current_app.logger.error("failed to bulk-update formula for product %s: %s", product_id, e)
        return _response(error=str(e), status=400)


@products_bp.route("/<product_id>/print-formula", methods=["GET"])
@require_auth
def print_formula(product_id):
    """Generate and return a PDF batch sheet for the product's formula.
    
    Optional query param ?target_size=<float> triggers a scaled batch sheet.
    All ingredient quantities are multiplied by (target_size / standard_batch_size).
    """
    try:
        # 1. Fetch product
        prod_resp = supabase.table("products") \
            .select("*") \
            .eq("id", product_id) \
            .single() \
            .execute()
        product = prod_resp.data

        # 2. Fetch formula lines
        form_resp = supabase.table("product_formula") \
            .select("*, raw_materials(name, unit)") \
            .eq("product_id", product_id) \
            .execute()

        # 3. Determine scaling
        target_size = request.args.get("target_size", type=float)
        standard_batch_size = float(product.get("batch_size") or 0)
        original_batch_size = None  # only set when actually scaling

        if target_size and standard_batch_size > 0 and target_size != standard_batch_size:
            factor = target_size / standard_batch_size
            original_batch_size = standard_batch_size
            # Mutate a copy so the product dict reflects the run size in the PDF header
            product = dict(product)
            product["batch_size"] = target_size
        else:
            factor = 1.0

        # 4. Build line list with scaled quantities
        formula_lines = []
        for line in (form_resp.data or []):
            qty = float(line["qty_per_batch"]) * factor
            formula_lines.append({
                "raw_material_name": line["raw_materials"]["name"],
                "unit": line["raw_materials"]["unit"],
                "qty_per_batch": round(qty, 4),
            })

        # 5. Generate PDF
        pdf_bytes = generate_formula_pdf(product, formula_lines, original_batch_size)

        return send_file(
            io.BytesIO(pdf_bytes),
            mimetype="application/pdf",
            as_attachment=True,
            download_name=f"BatchSheet_{product['name'].replace(' ', '_')}.pdf"
        )
    except Exception as e:
        current_app.logger.error("failed to print formula for product %s: %s", product_id, e)
        return _response(error=str(e), status=500)


@products_bp.route("/import-csv", methods=["POST"])
@require_auth
def import_products_csv():
    try:
        if 'file' not in request.files:
            return _response(error="No file uploaded", status=400)
        
        file = request.files['file']
        if not file.filename.endswith('.csv'):
            return _response(error="Only CSV files allowed", status=400)

        stream = io.StringIO(file.stream.read().decode("utf-8-sig"), newline=None)
        csv_input = csv.DictReader(stream)
        
        # Get all categories to map names to IDs
        cat_resp = supabase.table("product_categories").select("*").execute()
        categories = {c["name"].lower(): c["id"] for c in (cat_resp.data or [])}

        parsed_products = []
        for row in csv_input:
            # Map CSV headers (case-insensitive and with spaces/underscores)
            # Expected: Name, Category, Wholesale Price, Retail Price, Wholesale Min Qty, Stock, Description
            name = row.get("Name") or row.get("name")
            if not name: continue
            
            cat_name = row.get("Category") or row.get("category")
            cat_id = categories.get(cat_name.lower()) if cat_name else None
            
            parsed_products.append({
                "name": name,
                "category_id": cat_id,
                "description": row.get("Description") or row.get("description", ""),
                "wholesale_price": float(row.get("Wholesale Price") or row.get("wholesale_price") or 0),
                "retail_price": float(row.get("Retail Price") or row.get("retail_price") or 0),
                "cost_price": float(row.get("Cost Price") or row.get("cost_price") or 0),
                "wholesale_min_qty": float(row.get("Wholesale Min Qty") or row.get("wholesale_min_qty") or 1),
                "selling_price": float(row.get("Selling Price") or row.get("selling_price") or 0),
                "stock_qty": float(row.get("Stock") or row.get("stock") or row.get("stock_qty") or 0),
                "low_stock_threshold": float(row.get("Low Stock") or row.get("low_stock") or 0),
                "supplier_name": row.get("Supplier Name") or row.get("supplier_name") or "",
                "supplier_number": row.get("Supplier Number") or row.get("supplier_number") or "",
            })

        if not parsed_products:
            return _response(data={"imported": 0, "updated": 0})

        # Fetch existing products to avoid duplicates
        existing_resp = supabase.table("products").select("id, name").execute()
        existing_products = {p["name"].lower(): p["id"] for p in (existing_resp.data or [])}

        to_insert = []
        updated_count = 0

        for prod in parsed_products:
            name_lower = prod["name"].lower()
            if name_lower in existing_products:
                # Product exists -> Update
                prod_id = existing_products[name_lower]
                update_data = dict(prod)
                del update_data["name"]  # No need to update the name
                
                supabase.table("products").update(update_data).eq("id", prod_id).execute()
                updated_count += 1
            else:
                # Product is new -> Insert
                to_insert.append(prod)

        inserted_count = 0
        if to_insert:
            # Insert in chunks of 50 to avoid any Supabase payload limits
            for i in range(0, len(to_insert), 50):
                batch = to_insert[i:i+50]
                supabase.table("products").insert(batch).execute()
                inserted_count += len(batch)
            
        user_email = getattr(getattr(request, 'user', None), 'email', 'unknown')
        current_app.logger.info("user %s imported products CSV: %d inserted, %d updated", user_email, inserted_count, updated_count)
        return _response(data={"imported": inserted_count, "updated": updated_count})
    except Exception as e:
        current_app.logger.error("failed to import products CSV: %s", e)
        return _response(error=str(e), status=400)


