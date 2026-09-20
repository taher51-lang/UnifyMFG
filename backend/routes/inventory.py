# backend/routes/inventory.py
# Stock levels, low-stock alerts, purchase log, and production log
# Purchase -> auto-increments raw material stock
# Production -> auto-decrements raw materials (via formulation), auto-increments finished goods

from flask import Blueprint, request, jsonify, current_app
from middleware.auth import require_auth
from config import supabase
from services.inventory_ledger import log_stock_change
from services.cost_calculator import recalculate_all_affected_products, _cascade_product_cost_to_formulations

inventory_bp = Blueprint("inventory", __name__)


def _response(data=None, error=None, status=200):
    return jsonify({"data": data, "error": error}), status


# ===================================================================
# INVENTORY LEDGER
# ===================================================================

@inventory_bp.route("/ledger", methods=["GET"])
@require_auth
def get_ledger():
    try:
        resp = supabase.table("stock_ledger") \
            .select("*, raw_materials(name, unit), products(name, selling_unit)") \
            .order("created_at", desc=True) \
            .limit(200) \
            .execute()
        return _response(data=resp.data)
    except Exception as e:
        current_app.logger.error("failed to get inventory ledger: %s", e)
        return _response(error=str(e), status=500)


# ===================================================================
# STOCK LEVELS & LOW-STOCK ALERTS
# ===================================================================

@inventory_bp.route("/raw-materials", methods=["GET"])
@require_auth
def raw_material_stock():
    """List all raw materials with stock levels; flag low-stock items."""
    try:
        resp = supabase.table("raw_materials") \
            .select("id, name, unit, stock_qty, low_stock_threshold, supplier_name") \
            .order("name") \
            .execute()

        items = resp.data or []
        for item in items:
            stock = float(item.get("stock_qty", 0))
            threshold = float(item.get("low_stock_threshold", 0))
            item["is_low_stock"] = stock <= threshold and threshold > 0

        return _response(data=items)
    except Exception as e:
        current_app.logger.error("failed to list raw material stock: %s", e)
        return _response(error=str(e), status=500)


@inventory_bp.route("/finished-goods", methods=["GET"])
@require_auth
def finished_goods_stock():
    """List all products with stock levels; flag low-stock items."""
    try:
        resp = supabase.table("products") \
            .select("id, name, stock_qty, low_stock_threshold, batch_unit, selling_price, cost_price, selling_unit, packaging_size, packaging_unit") \
            .order("name") \
            .execute()

        items = resp.data or []
        for item in items:
            stock = float(item.get("stock_qty", 0))
            threshold = float(item.get("low_stock_threshold", 0))
            item["is_low_stock"] = stock <= threshold and threshold > 0

        return _response(data=items)
    except Exception as e:
        current_app.logger.error("failed to list finished goods stock: %s", e)
        return _response(error=str(e), status=500)


@inventory_bp.route("/low-stock", methods=["GET"])
@require_auth
def low_stock_alerts():
    """Return all items (raw materials + finished goods) below their threshold."""
    try:
        # Raw materials below threshold
        rm_resp = supabase.table("raw_materials") \
            .select("id, name, unit, stock_qty, low_stock_threshold") \
            .execute()
        low_rm = [
            {**item, "type": "raw_material"}
            for item in (rm_resp.data or [])
            if float(item.get("low_stock_threshold", 0)) > 0
            and float(item.get("stock_qty", 0)) <= float(item.get("low_stock_threshold", 0))
        ]

        # Finished goods below threshold
        fg_resp = supabase.table("products") \
            .select("id, name, batch_unit, stock_qty, low_stock_threshold") \
            .execute()
        low_fg = [
            {**item, "type": "finished_good"}
            for item in (fg_resp.data or [])
            if float(item.get("low_stock_threshold", 0)) > 0
            and float(item.get("stock_qty", 0)) <= float(item.get("low_stock_threshold", 0))
        ]

        return _response(data={"raw_materials": low_rm, "finished_goods": low_fg})
    except Exception as e:
        current_app.logger.error("failed to get low stock alerts: %s", e)
        return _response(error=str(e), status=500)


# ===================================================================
# PURCHASE LOG -- buying raw materials
# ===================================================================

@inventory_bp.route("/purchases", methods=["GET"])
@require_auth
def list_purchases():
    try:
        resp = supabase.table("purchase_log") \
            .select("*, raw_materials(name, unit)") \
            .order("purchase_date", desc=True) \
            .execute()
        return _response(data=resp.data)
    except Exception as e:
        current_app.logger.error("failed to list purchases: %s", e)
        return _response(error=str(e), status=500)


@inventory_bp.route("/purchases", methods=["POST"])
@require_auth
def record_purchase():
    """
    Record a raw material purchase.
    Auto-increments the raw material's stock_qty.
    """
    try:
        body = request.get_json()
        rm_id = body["raw_material_id"]
        qty = float(body["qty"])

        # Insert purchase log entry
        row = {
            "raw_material_id": rm_id,
            "qty": qty,
            "price_paid": body.get("price_paid", 0),
            "supplier": body.get("supplier", ""),
            "purchase_date": body.get("purchase_date"),
            "notes": body.get("notes", ""),
        }
        log_resp = supabase.table("purchase_log").insert(row).execute()

        # Increment raw material stock
        rm_resp = supabase.table("raw_materials") \
            .select("stock_qty") \
            .eq("id", rm_id) \
            .single() \
            .execute()
        current_stock = float(rm_resp.data["stock_qty"])
        new_stock = current_stock + qty

        # Update raw material stock and unit price (Latest Replacement Cost method)
        price_paid = float(body.get("price_paid", 0))
        update_fields = {"stock_qty": new_stock}
        
        # Only overwrite the unit price if a valid price was paid (ignore $0 free samples)
        if price_paid > 0 and qty > 0:
            new_unit_cost = round(price_paid / qty, 4)
            update_fields["price_per_unit"] = new_unit_cost

        supabase.table("raw_materials") \
            .update(update_fields) \
            .eq("id", rm_id) \
            .execute()
            
        # If the price was updated, cascade the cost to all affected formulations
        if "price_per_unit" in update_fields:
            recalculate_all_affected_products(rm_id)

        log_stock_change(
            "raw_material", rm_id, qty, new_stock, 
            "purchase", f"Purchased from {body.get('supplier', 'unknown')}"
        )

        result = log_resp.data[0] if log_resp.data else {}
        result["new_stock_qty"] = new_stock
        user_email = getattr(getattr(request, 'user', None), 'email', 'unknown')
        current_app.logger.info("user %s recorded purchase of raw material %s qty %s", user_email, rm_id, qty)
        return _response(data=result, status=201)
    except Exception as e:
        current_app.logger.error("failed to record purchase for raw material %s: %s", body.get('raw_material_id', 'unknown') if 'body' in dir() else 'unknown', e)
        return _response(error=str(e), status=400)


# ===================================================================
# PRODUCTION LOG -- producing finished goods
# ===================================================================

@inventory_bp.route("/production", methods=["GET"])
@require_auth
def list_production():
    try:
        resp = supabase.table("production_log") \
            .select("*, products(name, batch_unit)") \
            .order("produced_date", desc=True) \
            .execute()
        return _response(data=resp.data)
    except Exception as e:
        current_app.logger.error("failed to list production logs: %s", e)
        return _response(error=str(e), status=500)


@inventory_bp.route("/production", methods=["POST"])
@require_auth
def record_production():
    """
    Record a production batch using Yield Allocation.
    - Expects formulation_id, batches_produced, and yields (array of {product_id, quantity}).
    - Validates total expected volume vs total yielded volume.
    - Deducts raw materials for the bulk formulation batch.
    - Increments stock for all yielded products.
    """
    try:
        body = request.get_json()
        formulation_id = body.get("formulation_id")
        batches = float(body.get("batches_produced", 0))
        yields = body.get("yields", [])  # list of dicts: product_id, quantity
        
        if not formulation_id or batches <= 0 or not yields:
            return _response(error="Missing formulation, valid batches, or yield data.", status=400)

        # 1. Fetch formulation details
        form_resp = supabase.table("formulations") \
            .select("id, name, batch_size") \
            .eq("id", formulation_id) \
            .single() \
            .execute()
        formulation = form_resp.data
        if not formulation:
            return _response(error="Formulation not found.", status=404)
            
        form_batch_size = float(formulation.get("batch_size") or 0)
        expected_volume = round(batches * form_batch_size, 6)

        # 2. Fetch all products to calculate yield volume
        product_ids = [y["product_id"] for y in yields]
        prod_resp = supabase.table("products") \
            .select("id, name, stock_qty, fill_volume") \
            .in_("id", product_ids) \
            .execute()
        products_map = {p["id"]: p for p in (prod_resp.data or [])}

        yielded_volume = 0.0
        for y in yields:
            pid = y["product_id"]
            qty = float(y["quantity"])
            prod = products_map.get(pid)
            if not prod:
                return _response(error=f"Product not found: {pid}", status=404)
            fill_vol = float(prod.get("fill_volume") or 0)
            yielded_volume += qty * fill_vol
        
        yielded_volume = round(yielded_volume, 6)

        # 3. Validate volumes match (tolerance of 0.01)
        if abs(expected_volume - yielded_volume) > 0.01:
            return _response(
                error=f"Volume mismatch. Expected {expected_volume} kg/L but yielded {yielded_volume} kg/L.", 
                status=400
            )

        # 4. Fetch all ingredient lines (raw materials + compound products)
        formula_resp = supabase.table("formulation_ingredients") \
            .select("raw_material_id, product_id, qty_per_batch, raw_materials(id, name, unit, stock_qty), products(id, name, selling_unit, stock_qty)") \
            .eq("formulation_id", formulation_id) \
            .execute()
        formula_lines = formula_resp.data or []

        if not formula_lines:
            return _response(error="This formulation has no ingredients defined.", status=400)

        rm_lines = [l for l in formula_lines if l.get("raw_material_id")]
        compound_lines = [l for l in formula_lines if l.get("product_id")]

        # 4a. Check raw material stock
        stock_errors = []
        for line in rm_lines:
            rm = line["raw_materials"]
            qty_needed = round(float(line["qty_per_batch"]) * batches, 6)
            current_stock = round(float(rm["stock_qty"] or 0), 6)
            if qty_needed > current_stock:
                stock_errors.append(f"'{rm['name']}': need {qty_needed} {rm['unit']}, only {current_stock} {rm['unit']} in stock")

        # 4b. Check compound product stock
        for line in compound_lines:
            prod = line["products"]
            qty_needed = round(float(line["qty_per_batch"]) * batches, 6)
            current_stock = round(float(prod["stock_qty"] or 0), 6)
            unit = prod.get("selling_unit") or "unit"
            if qty_needed > current_stock:
                stock_errors.append(f"'{prod['name']}' (compound): need {qty_needed} {unit}, only {current_stock} {unit} in stock")

        if stock_errors:
            return _response(error="Insufficient stock:\n" + "\n".join(stock_errors), status=400)

        # 5a. Deduct raw materials
        stock_updates = []
        for line in rm_lines:
            rm = line["raw_materials"]
            rm_id = line["raw_material_id"]
            qty_needed = round(float(line["qty_per_batch"]) * batches, 6)
            current_stock = round(float(rm["stock_qty"] or 0), 6)
            new_stock = round(current_stock - qty_needed, 6)

            supabase.table("raw_materials").update({"stock_qty": new_stock}).eq("id", rm_id).execute()
            
            log_stock_change(
                "raw_material", rm_id, -qty_needed, new_stock, 
                "production_consumption", f"Consumed for {batches} batches of {formulation['name']}"
            )
            
            stock_updates.append({
                "type": "raw_material",
                "name": rm["name"],
                "unit": rm["unit"],
                "consumed": qty_needed,
                "remaining": new_stock,
            })

        # 5b. Deduct compound product stock
        for line in compound_lines:
            prod = line["products"]
            prod_id = line["product_id"]
            qty_needed = round(float(line["qty_per_batch"]) * batches, 6)
            current_stock = round(float(prod["stock_qty"] or 0), 6)
            new_stock = round(current_stock - qty_needed, 6)

            supabase.table("products").update({"stock_qty": new_stock}).eq("id", prod_id).execute()
            
            log_stock_change(
                "product", prod_id, -qty_needed, new_stock, 
                "production_consumption", f"Compound consumed for {batches} batches of {formulation['name']}"
            )
            
            stock_updates.append({
                "type": "compound_product",
                "name": prod["name"],
                "unit": prod.get("selling_unit") or "unit",
                "consumed": qty_needed,
                "remaining": new_stock,
            })

        # 6. Increment finished goods stock and create logs
        log_rows = []
        for y in yields:
            pid = y["product_id"]
            qty = float(y["quantity"])
            prod = products_map[pid]
            current_product_stock = round(float(prod["stock_qty"] or 0), 6)
            new_product_stock = round(current_product_stock + qty, 6)
            
            supabase.table("products").update({"stock_qty": new_product_stock}).eq("id", pid).execute()
            
            log_stock_change(
                "product", pid, qty, new_product_stock, 
                "production_yield", f"Yield from {batches} batches of {formulation['name']}"
            )
            
            log_rows.append({
                "product_id": pid,
                "batches_produced": qty,
                "produced_date": body.get("produced_date"),
                "notes": (body.get("notes", "") + f" (Yield from {batches} batches of {formulation['name']})").strip()
            })
            
        supabase.table("production_log").insert(log_rows).execute()

        user_email = getattr(getattr(request, 'user', None), 'email', 'unknown')
        current_app.logger.info("user %s recorded production of %s batches of formulation %s (%d products yielded)", user_email, batches, formulation_id, len(yields))
        return _response(data={
            "expected_volume": expected_volume,
            "yielded_volume": yielded_volume,
            "stock_consumption": stock_updates,
            "products_yielded": len(yields)
        }, status=201)

    except Exception as e:
        current_app.logger.error("failed to record production for formulation %s: %s", body.get('formulation_id', 'unknown') if 'body' in dir() else 'unknown', e)
        return _response(error=str(e), status=400)


# ===================================================================
# PRODUCT PURCHASE LOG -- buying tradeable products in bulk
# ===================================================================

@inventory_bp.route("/product-purchases", methods=["GET"])
@require_auth
def list_product_purchases():
    """List all product purchases (buying bags/packages of trading products)."""
    try:
        resp = supabase.table("product_purchase_log") \
            .select("*, products(name, selling_unit, packaging_unit, packaging_size)") \
            .order("purchase_date", desc=True) \
            .execute()
        return _response(data=resp.data)
    except Exception as e:
        current_app.logger.error("failed to list product purchases: %s", e)
        return _response(error=str(e), status=500)


@inventory_bp.route("/product-purchases", methods=["POST"])
@require_auth
def record_product_purchase():
    """
    Record a product purchase (buying packages/bags).
    Auto-increments the product's stock_qty in selling units.

    Expects:
    {
        "product_id": "...",
        "qty_packages": 3,          // number of packages bought
        "price_paid": 2400,         // total price paid
        "supplier": "ABC Traders",
        "purchase_date": "2026-06-20",
        "notes": ""
    }
    """
    try:
        body = request.get_json()
        product_id = body["product_id"]
        qty_packages = float(body["qty_packages"])

        if qty_packages <= 0:
            return _response(error="Quantity must be greater than zero.", status=400)

        # Fetch product to get packaging_size
        prod_resp = supabase.table("products") \
            .select("stock_qty, packaging_size, selling_unit, packaging_unit") \
            .eq("id", product_id) \
            .single() \
            .execute()
        product = prod_resp.data

        packaging_size = float(product.get("packaging_size") or 0)

        # Calculate total selling units added
        # If no packaging_size, treat qty_packages as direct units (e.g., individual items)
        if packaging_size > 0:
            qty_units = round(qty_packages * packaging_size, 6)
        else:
            qty_units = qty_packages

        # Insert purchase log entry
        row = {
            "product_id": product_id,
            "qty_packages": qty_packages,
            "qty_units": qty_units,
            "price_paid": body.get("price_paid", 0),
            "supplier": body.get("supplier", ""),
            "purchase_date": body.get("purchase_date"),
            "notes": body.get("notes", ""),
        }
        log_resp = supabase.table("product_purchase_log").insert(row).execute()

        # Increment product stock and update cost_price (Latest Replacement Cost method)
        current_stock = float(product["stock_qty"] or 0)
        new_stock = round(current_stock + qty_units, 6)
        
        price_paid = float(body.get("price_paid", 0))
        update_fields = {"stock_qty": new_stock}
        
        # Only overwrite the cost price if a valid price was paid (ignore $0 free samples)
        if price_paid > 0 and qty_units > 0:
            if packaging_size > 0 and qty_packages > 0:
                # User wants cost_price to reflect the Package Price (e.g., per Drum)
                new_unit_cost = round(price_paid / qty_packages, 4)
            else:
                # Base unit calculation
                new_unit_cost = round(price_paid / qty_units, 4)
            update_fields["cost_price"] = new_unit_cost

        supabase.table("products") \
            .update(update_fields) \
            .eq("id", product_id) \
            .execute()
            
        # If the cost price was updated, cascade to formulations that use it as a compound
        if "cost_price" in update_fields:
            _cascade_product_cost_to_formulations(product_id)

        log_stock_change(
            "product", product_id, qty_units, new_stock, 
            "purchase", f"Purchased {qty_packages} {product.get('packaging_unit', 'unit')}s from {body.get('supplier', 'unknown')}"
        )

        result = log_resp.data[0] if log_resp.data else {}
        result["new_stock_qty"] = new_stock
        result["qty_units_added"] = qty_units
        user_email = getattr(getattr(request, 'user', None), 'email', 'unknown')
        current_app.logger.info("user %s recorded product purchase %s qty_packages %s", user_email, product_id, qty_packages)
        return _response(data=result, status=201)
    except Exception as e:
        current_app.logger.error("failed to record product purchase for %s: %s", body.get('product_id', 'unknown') if 'body' in dir() else 'unknown', e)
        return _response(error=str(e), status=400)


# ===================================================================
# LOOSE PACKING LOG -- repacking bulk raw materials into finished products
# ===================================================================

@inventory_bp.route("/loose-packing", methods=["GET"])
@require_auth
def list_loose_packing():
    """History of repacking operations."""
    try:
        # We need to alias the foreign keys because both point to products table
        resp = supabase.table("loose_packing_log") \
            .select("*, bulk_product:products!bulk_product_id(name, selling_unit, batch_unit), yield_product:products!yield_product_id(name, selling_unit, batch_unit)") \
            .order("packing_date", desc=True) \
            .limit(100) \
            .execute()
        return _response(data=resp.data)
    except Exception as e:
        current_app.logger.error("failed to list loose packing logs: %s", e)
        return _response(error=str(e), status=500)


@inventory_bp.route("/loose-packing", methods=["POST"])
@require_auth
def record_loose_packing():
    """
    Record repacking of a bulk product into loose products.
    Deducts stock from bulk_product, adds stock to yield_product.
    """
    try:
        body = request.get_json()
        bulk_id = body.get("bulk_product_id")
        yield_id = body.get("yield_product_id")
        bulk_qty = float(body.get("bulk_product_qty", 0))
        yield_qty = float(body.get("yield_product_qty", 0))
        packing_date = body.get("packing_date")

        if not bulk_id or not yield_id or bulk_qty <= 0 or yield_qty <= 0:
            return _response(error="Missing required fields or invalid quantities", status=400)

        # 1. Fetch current bulk product stock and cost
        bulk_resp = supabase.table("products").select("stock_qty, name, selling_unit, batch_unit, cost_price, packaging_size").eq("id", bulk_id).execute()
        if not bulk_resp.data:
            return _response(error="Bulk product not found", status=404)
        bulk_prod = bulk_resp.data[0]
        current_bulk_stock = float(bulk_prod.get("stock_qty") or 0)
        current_bulk_cost = float(bulk_prod.get("cost_price") or 0)
        bulk_pkg_size = float(bulk_prod.get("packaging_size") or 1)
        if bulk_pkg_size <= 0: bulk_pkg_size = 1

        # 2. Fetch current yield product stock
        yield_resp = supabase.table("products").select("stock_qty, name, selling_unit, batch_unit, cost_price").eq("id", yield_id).execute()
        if not yield_resp.data:
            return _response(error="Yield product not found", status=404)
        yield_prod = yield_resp.data[0]
        current_yield_stock = float(yield_prod["stock_qty"] or 0)
        current_yield_cost = float(yield_prod["cost_price"] or 0)

        # Guard: check if enough bulk stock
        if bulk_qty > current_bulk_stock:
            return _response(error=f"Insufficient stock for {bulk_prod['name']}. Have {current_bulk_stock}, need {bulk_qty}.", status=400)

        # 3. Deduct Bulk stock
        new_bulk_stock = round(current_bulk_stock - bulk_qty, 6)
        supabase.table("products").update({"stock_qty": new_bulk_stock}).eq("id", bulk_id).execute()

        log_stock_change(
            "product", bulk_id, -bulk_qty, new_bulk_stock, 
            "loose_packing_consumption", f"Repacked into {yield_qty} units of {yield_prod['name']}"
        )

        # 4. Add Yield stock and update derived cost
        new_yield_stock = round(current_yield_stock + yield_qty, 6)
        new_yield_cost = current_yield_cost
        
        if current_bulk_cost > 0:
            true_bulk_cost_per_unit = current_bulk_cost / bulk_pkg_size
            total_bulk_value_used = true_bulk_cost_per_unit * bulk_qty
            new_yield_cost = round(total_bulk_value_used / yield_qty, 2)
            
        supabase.table("products").update({
            "stock_qty": new_yield_stock,
            "cost_price": new_yield_cost
        }).eq("id", yield_id).execute()

        log_stock_change(
            "product", yield_id, yield_qty, new_yield_stock, 
            "loose_packing_yield", f"Yielded from {bulk_qty} of {bulk_prod['name']}"
        )

        # 5. Insert log
        log_row = {
            "bulk_product_id": bulk_id,
            "yield_product_id": yield_id,
            "bulk_product_qty": bulk_qty,
            "yield_product_qty": yield_qty,
            "packing_date": packing_date,
            "notes": body.get("notes", "")
        }
        log_resp = supabase.table("loose_packing_log").insert(log_row).execute()

        user_email = getattr(getattr(request, 'user', None), 'email', 'unknown')
        current_app.logger.info("user %s recorded loose packing: %s of %s -> %s of %s", user_email, bulk_qty, bulk_id, yield_qty, yield_id)
        
        return _response(data={
            "log": log_resp.data[0] if log_resp.data else None,
            "new_bulk_stock": new_bulk_stock,
            "new_yield_stock": new_yield_stock
        }, status=201)

    except Exception as e:
        current_app.logger.error("failed to record loose packing: %s", e)
        return _response(error=str(e), status=400)
