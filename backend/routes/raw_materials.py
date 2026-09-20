# backend/routes/raw_materials.py
# CRUD for raw materials + price history logging + cascade cost recalculation

from flask import Blueprint, request, jsonify, current_app
from middleware.auth import require_auth
from config import supabase
from services.cost_calculator import recalculate_all_affected_products
from services.unit_converter import convert_qty
import csv
import io
from services.inventory_ledger import log_stock_change

raw_materials_bp = Blueprint("raw_materials", __name__)


def _response(data=None, error=None, status=200):
    """Standard JSON envelope."""
    return jsonify({"data": data, "error": error}), status


# ── LIST all raw materials (with optional search & unit filter) ─────────
@raw_materials_bp.route("", methods=["GET"])
@require_auth
def list_raw_materials():
    try:
        query = supabase.table("raw_materials").select("*").order("name")

        # Optional search by name
        search = request.args.get("search", "").strip()
        if search:
            query = query.ilike("name", f"%{search}%")

        # Optional filter by unit type
        unit_filter = request.args.get("unit", "").strip()
        if unit_filter:
            query = query.eq("unit", unit_filter)

        resp = query.execute()
        return _response(data=resp.data)
    except Exception as e:
        current_app.logger.error("failed to list raw materials: %s", e)
        return _response(error=str(e), status=500)


# ── GET single raw material ────────────────────────────────────────────
@raw_materials_bp.route("/<material_id>", methods=["GET"])
@require_auth
def get_raw_material(material_id):
    try:
        resp = supabase.table("raw_materials") \
            .select("*") \
            .eq("id", material_id) \
            .single() \
            .execute()
        return _response(data=resp.data)
    except Exception as e:
        current_app.logger.error("failed to get raw material %s: %s", material_id, e)
        return _response(error=str(e), status=404)


# ── CREATE raw material ────────────────────────────────────────────────
@raw_materials_bp.route("", methods=["POST"])
@require_auth
def create_raw_material():
    try:
        body = request.get_json()
        row = {
            "name": body["name"],
            "description": body.get("description", ""),
            "unit": body["unit"],
            "price_per_unit": body["price_per_unit"],
            "stock_qty": body.get("stock_qty", 0),
            "low_stock_threshold": body.get("low_stock_threshold", 0),
            "supplier_name": body.get("supplier_name", ""),
        }
        resp = supabase.table("raw_materials").insert(row).execute()
        user_email = getattr(getattr(request, 'user', None), 'email', 'unknown')
        new_id = resp.data[0]["id"] if resp.data else "unknown"
        current_app.logger.info("user %s created raw material %s", user_email, new_id)
        return _response(data=resp.data[0] if resp.data else None, status=201)
    except Exception as e:
        current_app.logger.error("failed to create raw material: %s", e)
        return _response(error=str(e), status=400)


# ── UPDATE raw material (with price history + cascade recalc) ──────────
@raw_materials_bp.route("/<material_id>", methods=["PUT"])
@require_auth
def update_raw_material(material_id):
    try:
        body = request.get_json()

        # Fetch current record to check for price and unit changes
        current = supabase.table("raw_materials") \
            .select("price_per_unit, unit, stock_qty, low_stock_threshold") \
            .eq("id", material_id) \
            .single() \
            .execute()
        old_price = float(current.data["price_per_unit"])
        old_unit  = current.data["unit"]
        old_stock = float(current.data.get("stock_qty") or 0)

        # Build update payload (only include fields that are present)
        update_fields = {}
        for field in ["name", "description", "unit", "price_per_unit",
                      "stock_qty", "low_stock_threshold", "supplier_name"]:
            if field in body:
                update_fields[field] = body[field]

        resp = supabase.table("raw_materials") \
            .update(update_fields) \
            .eq("id", material_id) \
            .execute()

        if "stock_qty" in body:
            new_stock = float(body["stock_qty"])
            if new_stock != old_stock:
                log_stock_change(
                    "raw_material", material_id, new_stock - old_stock, new_stock, 
                    "manual_edit", "Manual edit via Raw Materials page"
                )

        # If price changed, log history and recalculate affected products
        new_price = float(body.get("price_per_unit", old_price))
        if "price_per_unit" in body and new_price != old_price:
            # Log price change
            supabase.table("raw_material_price_history").insert({
                "raw_material_id": material_id,
                "old_price": old_price,
                "new_price": new_price,
            }).execute()

            # Recalculate cost prices for all products using this material
            recalculate_all_affected_products(material_id)

        user_email = getattr(getattr(request, 'user', None), 'email', 'unknown')
        current_app.logger.info("user %s updated raw material %s", user_email, material_id)
        return _response(data=resp.data[0] if resp.data else None)
    except Exception as e:
        current_app.logger.error("failed to update raw material %s: %s", material_id, e)
        return _response(error=str(e), status=400)


# ── DELETE raw material ────────────────────────────────────────────────
@raw_materials_bp.route("/<material_id>", methods=["DELETE"])
@require_auth
def delete_raw_material(material_id):
    try:
        supabase.table("raw_materials") \
            .delete() \
            .eq("id", material_id) \
            .execute()
        user_email = getattr(getattr(request, 'user', None), 'email', 'unknown')
        current_app.logger.info("user %s deleted raw material %s", user_email, material_id)
        return _response(data={"deleted": material_id})
    except Exception as e:
        current_app.logger.error("failed to delete raw material %s: %s", material_id, e)
        return _response(error=str(e), status=400)


# ── GET price history for a raw material ───────────────────────────────
@raw_materials_bp.route("/<material_id>/price-history", methods=["GET"])
@require_auth
def get_price_history(material_id):
    try:
        resp = supabase.table("raw_material_price_history") \
            .select("*") \
            .eq("raw_material_id", material_id) \
            .order("changed_at", desc=True) \
            .execute()
        return _response(data=resp.data)
    except Exception as e:
        current_app.logger.error("failed to get price history for %s: %s", material_id, e)
        return _response(error=str(e), status=500)


# ── BULK IMPORT from CSV ───────────────────────────────────────────────
VALID_UNITS = {"kg", "g", "ml", "L", "pcs", "oz", "lb"}

@raw_materials_bp.route("/import-csv", methods=["POST"])
@require_auth
def import_csv():
    """
    Import raw materials from a CSV file.
    Expected columns: name, unit, price_per_unit
    Optional columns: description, stock_qty, low_stock_threshold, supplier_name
    """
    try:
        if "file" not in request.files:
            return _response(error="No file uploaded", status=400)

        file = request.files["file"]
        if not file.filename.endswith(".csv"):
            return _response(error="File must be a .csv", status=400)

        # Read and decode CSV
        stream = io.StringIO(file.stream.read().decode("utf-8-sig"))
        reader = csv.DictReader(stream)

        # Normalize header names (strip whitespace, lowercase)
        if reader.fieldnames is None:
            return _response(error="CSV file is empty", status=400)
        reader.fieldnames = [f.strip().lower().replace(" ", "_") for f in reader.fieldnames]

        # Validate required columns exist
        required = {"name", "unit", "price_per_unit"}
        missing = required - set(reader.fieldnames)
        if missing:
            return _response(
                error=f"Missing required columns: {', '.join(missing)}. "
                      f"Required: name, unit, price_per_unit",
                status=400,
            )

        rows_to_insert = []
        errors = []

        for i, row in enumerate(reader, start=2):  # start=2 because row 1 is header
            name = (row.get("name") or "").strip()
            unit = (row.get("unit") or "").strip()
            price_str = (row.get("price_per_unit") or "").strip()

            # Validate required fields
            if not name:
                errors.append(f"Row {i}: missing name")
                continue
            if unit not in VALID_UNITS:
                errors.append(f"Row {i} ({name}): invalid unit '{unit}'. Must be one of: {', '.join(sorted(VALID_UNITS))}")
                continue
            try:
                price = float(price_str)
                if price < 0:
                    raise ValueError()
            except (ValueError, TypeError):
                errors.append(f"Row {i} ({name}): invalid price '{price_str}'")
                continue

            rows_to_insert.append({
                "name": name,
                "description": (row.get("description") or "").strip(),
                "unit": unit,
                "price_per_unit": price,
                "stock_qty": float(row.get("stock_qty") or 0),
                "low_stock_threshold": float(row.get("low_stock_threshold") or 0),
                "supplier_name": (row.get("supplier_name") or "").strip(),
            })

        if not rows_to_insert and errors:
            return _response(error="No valid rows found. " + "; ".join(errors), status=400)

        # Bulk insert
        inserted = []
        if rows_to_insert:
            resp = supabase.table("raw_materials").insert(rows_to_insert).execute()
            inserted = resp.data or []

        user_email = getattr(getattr(request, 'user', None), 'email', 'unknown')
        current_app.logger.info("user %s imported CSV: %d raw materials inserted, %d skipped", user_email, len(inserted), len(errors))
        return _response(data={
            "imported": len(inserted),
            "skipped": len(errors),
            "errors": errors[:20],  # cap at 20 error messages
        }, status=201)

    except Exception as e:
        current_app.logger.error("failed to import raw materials CSV: %s", e)
        return _response(error=f"Import failed: {str(e)}", status=500)
