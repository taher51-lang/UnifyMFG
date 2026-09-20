# backend/routes/invoices.py
# Full CRUD for invoices + line items + status transitions + PDF generation
# On confirmation → auto-deduct finished goods stock

from flask import Blueprint, request, jsonify, send_file, current_app
from middleware.auth import require_auth
import io
from config import supabase
from services.pdf_generator import generate_invoice_pdf

invoices_bp = Blueprint("invoices", __name__)


def _response(data=None, error=None, status=200):
    return jsonify({"data": data, "error": error}), status


def _get_next_invoice_number():
    """Generate the next sequential invoice number (INV-001, INV-002, ...).
    
    Robust approach: fetches ALL invoice numbers, parses every numeric suffix,
    and returns max + 1. This avoids race conditions from created_at ordering.
    """
    resp = supabase.table("invoices") \
        .select("invoice_number") \
        .execute()

    max_num = 0
    for inv in (resp.data or []):
        inv_num = inv.get("invoice_number", "")
        try:
            parts = inv_num.split("-")
            if len(parts) >= 2:
                num = int(parts[-1])
                if num > max_num:
                    max_num = num
        except (ValueError, IndexError):
            pass

    return f"INV-{max_num + 1:03d}"


# ── LIST all invoices ──────────────────────────────────────────────────
@invoices_bp.route("", methods=["GET"])
@require_auth
def list_invoices():
    try:
        query = supabase.table("invoices") \
            .select("*, customers(name, company_name)") \
            .order("created_at", desc=True)

        # Filter by status
        status_filter = request.args.get("status", "").strip()
        if status_filter:
            query = query.eq("status", status_filter)

        # Filter by customer
        customer_filter = request.args.get("customer_id", "").strip()
        if customer_filter:
            query = query.eq("customer_id", customer_filter)

        resp = query.execute()
        return _response(data=resp.data)
    except Exception as e:
        current_app.logger.error("failed to list invoices: %s", e)
        return _response(error=str(e), status=500)


# ── GET single invoice with items ─────────────────────────────────────
@invoices_bp.route("/<invoice_id>", methods=["GET"])
@require_auth
def get_invoice(invoice_id):
    try:
        resp = supabase.table("invoices") \
            .select("*, customers(*), invoice_items(*, products(name, batch_unit))") \
            .eq("id", invoice_id) \
            .single() \
            .execute()
        return _response(data=resp.data)
    except Exception as e:
        current_app.logger.error("failed to get invoice %s: %s", invoice_id, e)
        return _response(error=str(e), status=404)


# ── CREATE invoice ────────────────────────────────────────────────────
@invoices_bp.route("", methods=["POST"])
@require_auth
def create_invoice():
    """
    Create a new invoice with line items.
    Expects:
    {
        "customer_id": "...",
        "due_date": "YYYY-MM-DD",
        "discount_pct": 0,
        "gst_pct": 18,
        "notes": "...",
        "items": [
            {"product_id": "...", "qty": 10, "unit_price": 150.00},
            ...
        ]
    }
    """
    try:
        body = request.get_json()
        items = body.get("items", [])

        # Calculate subtotal from line items
        subtotal = 0.0
        item_rows = []
        for item in items:
            qty = float(item["qty"])
            unit_price = float(item["unit_price"])
            line_total = round(qty * unit_price, 2)
            subtotal += line_total
            item_rows.append({
                "product_id": item["product_id"],
                "qty": qty,
                "unit_price": unit_price,
                "line_total": line_total,
            })

        # Calculate totals
        discount_pct = float(body.get("discount_pct", 0))
        gst_pct = float(body.get("gst_pct", 0))
        discount_amount = subtotal * (discount_pct / 100)
        after_discount = subtotal - discount_amount
        gst_amount = after_discount * (gst_pct / 100)
        total = round(after_discount + gst_amount, 2)

        # Create invoice record
        invoice_number = _get_next_invoice_number()
        invoice_row = {
            "invoice_number": invoice_number,
            "customer_id": body["customer_id"],
            "status": "draft",
            "invoice_date": body.get("invoice_date"),
            "due_date": body.get("due_date"),
            "subtotal": round(subtotal, 2),
            "discount_pct": discount_pct,
            "gst_pct": gst_pct,
            "total": total,
            "amount_paid": 0,
            "notes": body.get("notes", ""),
        }

        inv_resp = supabase.table("invoices").insert(invoice_row).execute()
        invoice = inv_resp.data[0]

        # Create line items linked to the invoice
        for item_row in item_rows:
            item_row["invoice_id"] = invoice["id"]
        if item_rows:
            supabase.table("invoice_items").insert(item_rows).execute()

        # Return the full invoice
        user_email = getattr(getattr(request, 'user', None), 'email', 'unknown')
        current_app.logger.info("user %s created invoice %s for customer %s", user_email, invoice_number, body["customer_id"])
        return get_invoice(invoice["id"])
    except Exception as e:
        current_app.logger.error("failed to create invoice: %s", e)
        return _response(error=str(e), status=400)


# ── UPDATE invoice (only if draft) ────────────────────────────────────
@invoices_bp.route("/<invoice_id>", methods=["PUT"])
@require_auth
def update_invoice(invoice_id):
    """Update invoice details and/or line items. Only draft invoices can be edited."""
    try:
        # Check current status
        current = supabase.table("invoices") \
            .select("status") \
            .eq("id", invoice_id) \
            .single() \
            .execute()

        if current.data["status"] != "draft":
            return _response(error="Only draft invoices can be edited", status=400)

        body = request.get_json()

        # Update line items if provided
        items = body.get("items")
        if items is not None:
            # Delete existing items
            supabase.table("invoice_items").delete().eq("invoice_id", invoice_id).execute()

            # Insert new items
            subtotal = 0.0
            item_rows = []
            for item in items:
                qty = float(item["qty"])
                unit_price = float(item["unit_price"])
                line_total = round(qty * unit_price, 2)
                subtotal += line_total
                item_rows.append({
                    "invoice_id": invoice_id,
                    "product_id": item["product_id"],
                    "qty": qty,
                    "unit_price": unit_price,
                    "line_total": line_total,
                })
            if item_rows:
                supabase.table("invoice_items").insert(item_rows).execute()

            # Recalculate totals
            discount_pct = float(body.get("discount_pct", 0))
            gst_pct = float(body.get("gst_pct", 0))
            discount_amount = subtotal * (discount_pct / 100)
            after_discount = subtotal - discount_amount
            gst_amount = after_discount * (gst_pct / 100)
            total = round(after_discount + gst_amount, 2)

            body["subtotal"] = round(subtotal, 2)
            body["total"] = total

        # Update invoice fields
        update_fields = {}
        for field in ["customer_id", "due_date", "discount_pct", "gst_pct",
                       "notes", "subtotal", "total", "invoice_date"]:
            if field in body:
                update_fields[field] = body[field]

        if update_fields:
            supabase.table("invoices") \
                .update(update_fields) \
                .eq("id", invoice_id) \
                .execute()

        user_email = getattr(getattr(request, 'user', None), 'email', 'unknown')
        current_app.logger.info("user %s updated invoice %s", user_email, invoice_id)
        return get_invoice(invoice_id)
    except Exception as e:
        current_app.logger.error("failed to update invoice %s: %s", invoice_id, e)
        return _response(error=str(e), status=400)


# ── STATUS TRANSITIONS ────────────────────────────────────────────────
@invoices_bp.route("/<invoice_id>/status", methods=["PUT"])
@require_auth
def update_status(invoice_id):
    """
    Change invoice status.
    Valid transitions:
      draft → confirmed / cancelled
      confirmed → paid / partial / cancelled
      partial → paid / cancelled
    Stock is NOT deducted here — it is managed by the separate Stock module.
    """
    try:
        body = request.get_json()
        new_status = body["status"]
        amount_paid = body.get("amount_paid")

        # Fetch current invoice
        current = supabase.table("invoices") \
            .select("*, invoice_items(product_id, qty)") \
            .eq("id", invoice_id) \
            .single() \
            .execute()
        invoice = current.data
        old_status = invoice["status"]

        # Validate transitions
        valid_transitions = {
            "draft": ["confirmed", "cancelled"],
            "confirmed": ["paid", "partial", "cancelled"],
            "partial": ["paid", "partial", "cancelled"],
        }
        allowed = valid_transitions.get(old_status, [])
        if new_status not in allowed:
            return _response(
                error=f"Cannot transition from '{old_status}' to '{new_status}'",
                status=400
            )

        update_fields = {"status": new_status}

        invoice_total = float(invoice.get("total", 0) or 0)
        existing_paid = float(invoice.get("amount_paid", 0) or 0)

        if new_status == "paid":
            # Always set amount_paid to the DB total — don't trust frontend
            update_fields["amount_paid"] = invoice_total

        elif new_status == "partial":
            # Validate the incoming payment amount
            if amount_paid is None or float(amount_paid) <= 0:
                return _response(
                    error="Payment amount must be greater than zero",
                    status=400
                )
            payment = float(amount_paid)
            new_total_paid = round(existing_paid + payment, 2)

            if new_total_paid >= invoice_total:
                return _response(
                    error=f"Partial payment of ₹{payment} would make total paid ₹{new_total_paid}, "
                          f"which meets or exceeds the invoice total of ₹{invoice_total}. "
                          f"Use 'Mark Fully Paid' instead.",
                    status=400
                )
            update_fields["amount_paid"] = new_total_paid

        supabase.table("invoices") \
            .update(update_fields) \
            .eq("id", invoice_id) \
            .execute()

        user_email = getattr(getattr(request, 'user', None), 'email', 'unknown')
        current_app.logger.info("user %s changed invoice %s status %s -> %s", user_email, invoice_id, old_status, new_status)
        return get_invoice(invoice_id)
    except Exception as e:
        current_app.logger.error("failed to update status of invoice %s: %s", invoice_id, e)
        return _response(error=str(e), status=400)


# ── DELETE invoice (only drafts) ──────────────────────────────────────
@invoices_bp.route("/<invoice_id>", methods=["DELETE"])
@require_auth
def delete_invoice(invoice_id):
    try:
        current = supabase.table("invoices") \
            .select("status") \
            .eq("id", invoice_id) \
            .single() \
            .execute()

        if current.data["status"] != "draft":
            return _response(error="Only draft invoices can be deleted", status=400)

        supabase.table("invoices").delete().eq("id", invoice_id).execute()
        user_email = getattr(getattr(request, 'user', None), 'email', 'unknown')
        current_app.logger.info("user %s deleted invoice %s", user_email, invoice_id)
        return _response(data={"deleted": invoice_id})
    except Exception as e:
        current_app.logger.error("failed to delete invoice %s: %s", invoice_id, e)
        return _response(error=str(e), status=400)


# ── PDF DOWNLOAD ──────────────────────────────────────────────────────
@invoices_bp.route("/<invoice_id>/pdf", methods=["GET"])
@require_auth
def download_pdf(invoice_id):
    """Generate and return a PDF for this invoice."""
    try:
        # Fetch full invoice with items and customer
        inv_resp = supabase.table("invoices") \
            .select("*, customers(*), invoice_items(*, products(name))") \
            .eq("id", invoice_id) \
            .single() \
            .execute()
        invoice = inv_resp.data

        customer = invoice.get("customers") or {}
        raw_items = invoice.get("invoice_items") or []

        # Enrich items with product names
        items = []
        for item in raw_items:
            product = item.get("products") or {}
            items.append({
                "product_name": product.get("name", "Unknown"),
                "qty": item.get("qty", 0),
                "unit_price": item.get("unit_price", 0),
                "line_total": item.get("line_total", 0),
            })

        pdf_bytes = generate_invoice_pdf(invoice, items, customer)

        return send_file(
            io.BytesIO(pdf_bytes),
            mimetype="application/pdf",
            as_attachment=True,
            download_name=f"{invoice.get('invoice_number', 'invoice')}.pdf",
        )
    except Exception as e:
        current_app.logger.error("failed to generate PDF for invoice %s: %s", invoice_id, e)
        return _response(error=str(e), status=500)
