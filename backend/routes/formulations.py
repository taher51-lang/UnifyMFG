# backend/routes/formulations.py
# CRUD for Formulations (compound recipes) and their ingredients.
# A Formulation is a standalone recipe that one or many Products can link to.

from flask import Blueprint, request, jsonify, send_file, current_app
from middleware.auth import require_auth
from config import supabase
from services.cost_calculator import recalculate_formulation_cost
from services.pdf_generator import generate_formula_pdf
import io
import uuid

formulations_bp = Blueprint("formulations", __name__)


def _response(data=None, error=None, status=200):
    return jsonify({"data": data, "error": error}), status


# ═══════════════════════════════════════════════════════════════════════
# FORMULATIONS CRUD
# ═══════════════════════════════════════════════════════════════════════

@formulations_bp.route("", methods=["GET"])
@require_auth
def list_formulations():
    """List all formulations, with a count of linked products."""
    try:
        resp = supabase.table("formulations") \
            .select("*, products(id)") \
            .order("name") \
            .execute()

        formulations = []
        for f in (resp.data or []):
            f["product_count"] = len(f.pop("products", []) or [])
            formulations.append(f)

        return _response(data=formulations)
    except Exception as e:
        current_app.logger.error("failed to list formulations: %s", e)
        return _response(error=str(e), status=500)


@formulations_bp.route("/<formulation_id>", methods=["GET"])
@require_auth
def get_formulation(formulation_id):
    try:
        resp = supabase.table("formulations") \
            .select("*") \
            .eq("id", formulation_id) \
            .single() \
            .execute()
        return _response(data=resp.data)
    except Exception as e:
        current_app.logger.error("failed to get formulation %s: %s", formulation_id, e)
        return _response(error=str(e), status=404)


@formulations_bp.route("", methods=["POST"])
@require_auth
def create_formulation():
    try:
        body = request.get_json()
        row = {
            "name": body["name"],
            "description": body.get("description", ""),
            "batch_size": body.get("batch_size"),
            "batch_unit": body.get("batch_unit"),
            "cost_price": 0,
        }
        resp = supabase.table("formulations").insert(row).execute()
        user_email = getattr(getattr(request, 'user', None), 'email', 'unknown')
        new_id = resp.data[0]["id"] if resp.data else "unknown"
        current_app.logger.info("user %s created formulation %s", user_email, new_id)
        return _response(data=resp.data[0] if resp.data else None, status=201)
    except Exception as e:
        current_app.logger.error("failed to create formulation: %s", e)
        return _response(error=str(e), status=400)


@formulations_bp.route("/<formulation_id>", methods=["PUT"])
@require_auth
def update_formulation(formulation_id):
    try:
        body = request.get_json()
        update_fields = {}
        for field in ["name", "description", "batch_size", "batch_unit"]:
            if field in body:
                update_fields[field] = body[field]

        resp = supabase.table("formulations") \
            .update(update_fields) \
            .eq("id", formulation_id) \
            .execute()

        # If batch_size changed, recalculate costs since cost_per_unit depends on it
        if "batch_size" in update_fields:
            recalculate_formulation_cost(formulation_id)

        user_email = getattr(getattr(request, 'user', None), 'email', 'unknown')
        current_app.logger.info("user %s updated formulation %s", user_email, formulation_id)
        return _response(data=resp.data[0] if resp.data else None)
    except Exception as e:
        current_app.logger.error("failed to update formulation %s: %s", formulation_id, e)
        return _response(error=str(e), status=400)


@formulations_bp.route("/<formulation_id>", methods=["DELETE"])
@require_auth
def delete_formulation(formulation_id):
    """Delete a formulation. Blocked if products are still linked."""
    try:
        linked = supabase.table("products") \
            .select("id") \
            .eq("formulation_id", formulation_id) \
            .execute()

        if linked.data:
            return _response(
                error=f"Cannot delete: {len(linked.data)} product(s) are linked to this formulation.",
                status=409
            )

        # Delete image from storage if exists
        form_data = supabase.table("formulations").select("image_url").eq("id", formulation_id).single().execute()
        if form_data.data and form_data.data.get("image_url"):
            try:
                image_url = form_data.data["image_url"]
                file_name = image_url.split("/")[-1]
                supabase.storage.from_("formulation-images").remove([file_name])
            except Exception:
                current_app.logger.error("failed to clean up storage image for formulation %s", formulation_id)
                pass # Proceed with deletion even if storage cleanup fails

        # Delete ingredients first
        supabase.table("formulation_ingredients").delete().eq("formulation_id", formulation_id).execute()

        # Delete formulation
        supabase.table("formulations").delete().eq("id", formulation_id).execute()
        user_email = getattr(getattr(request, 'user', None), 'email', 'unknown')
        current_app.logger.info("user %s deleted formulation %s", user_email, formulation_id)
        return _response(data={"deleted": formulation_id})
    except Exception as e:
        current_app.logger.error("failed to delete formulation %s: %s", formulation_id, e)
        return _response(error=str(e), status=400)


# ═══════════════════════════════════════════════════════════════════════
# FORMULATION IMAGE UPLOAD
# ═══════════════════════════════════════════════════════════════════════

@formulations_bp.route("/<formulation_id>/image", methods=["POST"])
@require_auth
def upload_image(formulation_id):
    try:
        if 'file' not in request.files:
            return _response(error="No file uploaded", status=400)
            
        file = request.files['file']
        if not file.filename:
            return _response(error="No selected file", status=400)
            
        ext = file.filename.split('.')[-1] if '.' in file.filename else ''
        file_name = f"{formulation_id}_{uuid.uuid4().hex}.{ext}"
        
        file_bytes = file.read()
        content_type = file.content_type or 'application/octet-stream'
        
        supabase.storage.from_("formulation-images").upload(
            file_name,
            file_bytes,
            {"content-type": content_type}
        )
        
        public_url = supabase.storage.from_("formulation-images").get_public_url(file_name)
        
        # update formulation
        supabase.table("formulations").update({"image_url": public_url}).eq("id", formulation_id).execute()
        user_email = getattr(getattr(request, 'user', None), 'email', 'unknown')
        current_app.logger.info("user %s uploaded image for formulation %s", user_email, formulation_id)
        return _response(data={"image_url": public_url})
    except Exception as e:
        current_app.logger.error("failed to upload image for formulation %s: %s", formulation_id, e)
        return _response(error=str(e), status=400)


@formulations_bp.route("/<formulation_id>/image", methods=["DELETE"])
@require_auth
def delete_image(formulation_id):
    try:
        resp = supabase.table("formulations").select("image_url").eq("id", formulation_id).single().execute()
        if not resp.data or not resp.data.get("image_url"):
            return _response(error="No image to delete", status=400)
            
        image_url = resp.data["image_url"]
        file_name = image_url.split("/")[-1]
        
        supabase.storage.from_("formulation-images").remove([file_name])
        supabase.table("formulations").update({"image_url": None}).eq("id", formulation_id).execute()
        user_email = getattr(getattr(request, 'user', None), 'email', 'unknown')
        current_app.logger.info("user %s deleted image for formulation %s", user_email, formulation_id)
        return _response(data={"deleted": True})
    except Exception as e:
        current_app.logger.error("failed to delete image for formulation %s: %s", formulation_id, e)
        return _response(error=str(e), status=400)


# ═══════════════════════════════════════════════════════════════════════
# INGREDIENT LINES
# ═══════════════════════════════════════════════════════════════════════

@formulations_bp.route("/<formulation_id>/ingredients", methods=["GET"])
@require_auth
def get_ingredients(formulation_id):
    """Get all ingredient lines for a formulation, with raw material or product details."""
    try:
        resp = supabase.table("formulation_ingredients") \
            .select("*, raw_materials(id, name, unit, price_per_unit), products(id, name, cost_price, selling_unit)") \
            .eq("formulation_id", formulation_id) \
            .execute()
        return _response(data=resp.data)
    except Exception as e:
        current_app.logger.error("failed to get ingredients for formulation %s: %s", formulation_id, e)
        return _response(error=str(e), status=500)


@formulations_bp.route("/<formulation_id>/ingredients/bulk", methods=["PUT"])
@require_auth
def bulk_update_ingredients(formulation_id):
    """
    Replace all ingredient lines for a formulation and recalculate cost.
    Expects: { "lines": [{ "raw_material_id": "...", "qty_per_batch": ... }] }
    Lines can also have "product_id" instead of "raw_material_id" for compound ingredients.
    """
    try:
        body = request.get_json()
        lines = body.get("lines", [])

        # Delete existing
        supabase.table("formulation_ingredients") \
            .delete() \
            .eq("formulation_id", formulation_id) \
            .execute()

        # Insert new — each line is either raw_material or product (compound)
        if lines:
            rows = []
            for line in lines:
                qty = line.get("qty_per_batch")
                if not qty or float(qty) <= 0:
                    continue
                row = {
                    "formulation_id": formulation_id,
                    "qty_per_batch": float(qty),
                }
                if line.get("product_id"):
                    row["product_id"] = line["product_id"]
                    row["raw_material_id"] = None
                elif line.get("raw_material_id"):
                    row["raw_material_id"] = line["raw_material_id"]
                    row["product_id"] = None
                else:
                    continue  # skip invalid lines
                rows.append(row)

            if rows:
                supabase.table("formulation_ingredients").insert(rows).execute()

        # Recalculate cost and cascade to linked products
        new_cost = recalculate_formulation_cost(formulation_id)

        user_email = getattr(getattr(request, 'user', None), 'email', 'unknown')
        current_app.logger.info("user %s bulk-updated ingredients for formulation %s (%d lines)", user_email, formulation_id, len(lines))
        return _response(data={"new_cost_price": new_cost, "lines_count": len(lines)})
    except Exception as e:
        current_app.logger.error("failed to bulk-update ingredients for formulation %s: %s", formulation_id, e)
        return _response(error=str(e), status=400)


# ═══════════════════════════════════════════════════════════════════════
# PRINT BATCH SHEET
# ═══════════════════════════════════════════════════════════════════════

@formulations_bp.route("/<formulation_id>/print", methods=["GET"])
@require_auth
def print_formulation(formulation_id):
    """
    Generate and return a PDF batch sheet for a formulation.
    Optional ?target_size=<float> for a scaled run.
    """
    try:
        form_resp = supabase.table("formulations") \
            .select("*") \
            .eq("id", formulation_id) \
            .single() \
            .execute()
        formulation = form_resp.data

        ing_resp = supabase.table("formulation_ingredients") \
            .select("*, raw_materials(name, unit), products(name, selling_unit)") \
            .eq("formulation_id", formulation_id) \
            .execute()

        # Scaling
        target_size = request.args.get("target_size", type=float)
        standard_batch_size = float(formulation.get("batch_size") or 0)
        original_batch_size = None

        if target_size and standard_batch_size > 0 and target_size != standard_batch_size:
            factor = target_size / standard_batch_size
            original_batch_size = standard_batch_size
            formulation = dict(formulation)
            formulation["batch_size"] = target_size
        else:
            factor = 1.0

        formula_lines = []
        for i in (ing_resp.data or []):
            qty = round(float(i["qty_per_batch"]) * factor, 4)
            if i.get("raw_materials"):
                formula_lines.append({
                    "raw_material_name": i["raw_materials"]["name"],
                    "unit": i["raw_materials"]["unit"],
                    "qty_per_batch": qty,
                })
            elif i.get("products"):
                formula_lines.append({
                    "raw_material_name": f"{i['products']['name']} (compound)",
                    "unit": i["products"].get("selling_unit") or "unit",
                    "qty_per_batch": qty,
                })

        pdf_bytes = generate_formula_pdf(formulation, formula_lines, original_batch_size)

        return send_file(
            io.BytesIO(pdf_bytes),
            mimetype="application/pdf",
            as_attachment=True,
            download_name=f"BatchSheet_{formulation['name'].replace(' ', '_')}.pdf"
        )
    except Exception as e:
        current_app.logger.error("failed to print formulation %s: %s", formulation_id, e)
        return _response(error=str(e), status=500)
