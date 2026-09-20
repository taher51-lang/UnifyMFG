# backend/routes/customers.py
# CRUD for customers + purchase history + outstanding dues

from flask import Blueprint, request, jsonify, current_app
from middleware.auth import require_auth
from config import supabase

customers_bp = Blueprint("customers", __name__)


def _response(data=None, error=None, status=200):
    return jsonify({"data": data, "error": error}), status


# ── LIST all customers ─────────────────────────────────────────────────
@customers_bp.route("", methods=["GET"])
@require_auth
def list_customers():
    try:
        query = supabase.table("customers").select("*").order("name")

        search = request.args.get("search", "").strip()
        if search:
            query = query.ilike("name", f"%{search}%")

        resp = query.execute()
        return _response(data=resp.data)
    except Exception as e:
        current_app.logger.error("failed to list customers: %s", e)
        return _response(error=str(e), status=500)


# ── ACCOUNTS RECEIVABLE LEDGER (ALL CUSTOMERS) ────────────────────────
@customers_bp.route("/ledger", methods=["GET"])
@require_auth
def all_customers_ledger():
    """Aggregated ledger with individual unpaid invoice details per customer."""
    try:
        resp = supabase.table("invoices") \
            .select("id, invoice_number, invoice_date, total, amount_paid, status, customer_id, customers(name, company_name)") \
            .in_("status", ["confirmed", "partial"]) \
            .execute()

        invoices = resp.data or []
        customer_ledgers = {}

        for inv in invoices:
            cid = inv["customer_id"]
            if cid not in customer_ledgers:
                customer = inv.get("customers") or {}
                customer_ledgers[cid] = {
                    "customer_id": cid,
                    "name": customer.get("name", "Unknown"),
                    "company_name": customer.get("company_name", ""),
                    "total_due": 0.0,
                    "unpaid_invoices_count": 0,
                    "oldest_unpaid_date": None,
                    "unpaid_invoices": []
                }

            total = float(inv.get("total", 0) or 0)
            paid = float(inv.get("amount_paid", 0) or 0)
            balance = round(total - paid, 2)
            
            if balance > 0:
                customer_ledgers[cid]["total_due"] += balance
                customer_ledgers[cid]["unpaid_invoices_count"] += 1
                customer_ledgers[cid]["unpaid_invoices"].append({
                    "id": inv["id"],
                    "invoice_number": inv["invoice_number"],
                    "invoice_date": inv.get("invoice_date"),
                    "status": inv["status"],
                    "total": total,
                    "paid": paid,
                    "balance": balance,
                })
                
                inv_date = inv.get("invoice_date")
                current_oldest = customer_ledgers[cid]["oldest_unpaid_date"]
                if not current_oldest or inv_date < current_oldest:
                    customer_ledgers[cid]["oldest_unpaid_date"] = inv_date

        for entry in customer_ledgers.values():
            entry["total_due"] = round(entry["total_due"], 2)
        result = list(customer_ledgers.values())
        return _response(data=result)
    except Exception as e:
        current_app.logger.error("failed to get customer ledger: %s", e)
        return _response(error=str(e), status=500)


# ── GET single customer ───────────────────────────────────────────────
@customers_bp.route("/<customer_id>", methods=["GET"])
@require_auth
def get_customer(customer_id):
    try:
        resp = supabase.table("customers") \
            .select("*") \
            .eq("id", customer_id) \
            .single() \
            .execute()
        return _response(data=resp.data)
    except Exception as e:
        current_app.logger.error("failed to get customer %s: %s", customer_id, e)
        return _response(error=str(e), status=404)


# ── CREATE customer ───────────────────────────────────────────────────
@customers_bp.route("", methods=["POST"])
@require_auth
def create_customer():
    try:
        body = request.get_json()
        row = {
            "name": body["name"],
            "company_name": body.get("company_name", ""),
            "phone": body.get("phone", ""),
            "email": body.get("email", ""),
            "address": body.get("address", ""),
            "gst_number": body.get("gst_number", ""),
        }
        resp = supabase.table("customers").insert(row).execute()
        user_email = getattr(getattr(request, 'user', None), 'email', 'unknown')
        new_id = resp.data[0]["id"] if resp.data else "unknown"
        current_app.logger.info("user %s created customer %s", user_email, new_id)
        return _response(data=resp.data[0] if resp.data else None, status=201)
    except Exception as e:
        current_app.logger.error("failed to create customer: %s", e)
        return _response(error=str(e), status=400)


# ── UPDATE customer ───────────────────────────────────────────────────
@customers_bp.route("/<customer_id>", methods=["PUT"])
@require_auth
def update_customer(customer_id):
    try:
        body = request.get_json()
        update_fields = {}
        for field in ["name", "company_name", "phone", "email", "address", "gst_number"]:
            if field in body:
                update_fields[field] = body[field]

        resp = supabase.table("customers") \
            .update(update_fields) \
            .eq("id", customer_id) \
            .execute()
        user_email = getattr(getattr(request, 'user', None), 'email', 'unknown')
        current_app.logger.info("user %s updated customer %s", user_email, customer_id)
        return _response(data=resp.data[0] if resp.data else None)
    except Exception as e:
        current_app.logger.error("failed to update customer %s: %s", customer_id, e)
        return _response(error=str(e), status=400)


# ── DELETE customer ───────────────────────────────────────────────────
@customers_bp.route("/<customer_id>", methods=["DELETE"])
@require_auth
def delete_customer(customer_id):
    try:
        supabase.table("customers").delete().eq("id", customer_id).execute()
        user_email = getattr(getattr(request, 'user', None), 'email', 'unknown')
        current_app.logger.info("user %s deleted customer %s", user_email, customer_id)
        return _response(data={"deleted": customer_id})
    except Exception as e:
        current_app.logger.error("failed to delete customer %s: %s", customer_id, e)
        return _response(error=str(e), status=400)


# ── PURCHASE HISTORY for a customer ───────────────────────────────────
@customers_bp.route("/<customer_id>/purchases", methods=["GET"])
@require_auth
def customer_purchases(customer_id):
    """Get all invoices for a customer with their line items."""
    try:
        resp = supabase.table("invoices") \
            .select("*, invoice_items(*, products(name))") \
            .eq("customer_id", customer_id) \
            .order("invoice_date", desc=True) \
            .execute()
        return _response(data=resp.data)
    except Exception as e:
        current_app.logger.error("failed to get purchases for customer %s: %s", customer_id, e)
        return _response(error=str(e), status=500)


# ── OUTSTANDING DUES for a customer ───────────────────────────────────
@customers_bp.route("/<customer_id>/dues", methods=["GET"])
@require_auth
def customer_dues(customer_id):
    """Calculate total outstanding amount for a customer (unpaid invoices)."""
    try:
        resp = supabase.table("invoices") \
            .select("id, invoice_number, total, amount_paid, status") \
            .eq("customer_id", customer_id) \
            .in_("status", ["confirmed", "partial"]) \
            .execute()

        invoices = resp.data or []
        total_due = 0.0
        unpaid_invoices = []

        for inv in invoices:
            total = float(inv.get("total", 0) or 0)
            paid = float(inv.get("amount_paid", 0) or 0)
            balance = total - paid
            if balance > 0:
                unpaid_invoices.append({
                    "invoice_id": inv["id"],
                    "invoice_number": inv["invoice_number"],
                    "total": total,
                    "paid": paid,
                    "balance": balance,
                })
                total_due += balance

        return _response(data={
            "total_outstanding": round(total_due, 2),
            "unpaid_invoices": unpaid_invoices,
        })
    except Exception as e:
        current_app.logger.error("failed to get dues for customer %s: %s", customer_id, e)
        return _response(error=str(e), status=500)


