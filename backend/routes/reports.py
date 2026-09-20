# backend/routes/reports.py
# Read-only dashboard aggregation queries
# Revenue, top products, top customers, profit, consumption trends, low stock

from flask import Blueprint, request, jsonify, current_app
from middleware.auth import require_auth
from config import supabase
from datetime import datetime, timedelta

reports_bp = Blueprint("reports", __name__)


def _response(data=None, error=None, status=200):
    return jsonify({"data": data, "error": error}), status


@reports_bp.route("/revenue", methods=["GET"])
@require_auth
def revenue():
    """Revenue this month and this year from confirmed/paid/partial invoices."""
    try:
        now = datetime.now()
        month_start = now.replace(day=1).strftime("%Y-%m-%d")
        year_start = now.replace(month=1, day=1).strftime("%Y-%m-%d")

        # All non-cancelled, non-draft invoices
        resp = supabase.table("invoices") \
            .select("total, invoice_date, status") \
            .in_("status", ["confirmed", "paid", "partial"]) \
            .execute()

        invoices = resp.data or []
        month_revenue = 0.0
        year_revenue = 0.0

        for inv in invoices:
            total = float(inv.get("total", 0) or 0)
            inv_date = inv.get("invoice_date", "")

            if inv_date >= year_start:
                year_revenue += total
            if inv_date >= month_start:
                month_revenue += total

        return _response(data={
            "month_revenue": round(month_revenue, 2),
            "year_revenue": round(year_revenue, 2),
            "month": now.strftime("%B %Y"),
        })
    except Exception as e:
        current_app.logger.error("failed to get revenue report: %s", e)
        return _response(error=str(e), status=500)


@reports_bp.route("/top-products", methods=["GET"])
@require_auth
def top_products():
    """Top 5 selling products by quantity and by revenue."""
    try:
        # Fetch all invoice items from confirmed/paid/partial invoices
        resp = supabase.table("invoice_items") \
            .select("product_id, qty, line_total, invoices!inner(status)") \
            .in_("invoices.status", ["confirmed", "paid", "partial"]) \
            .execute()

        items = resp.data or []

        # Aggregate by product
        product_stats = {}
        for item in items:
            pid = item["product_id"]
            if pid not in product_stats:
                product_stats[pid] = {"qty": 0, "revenue": 0}
            product_stats[pid]["qty"] += float(item.get("qty", 0))
            product_stats[pid]["revenue"] += float(item.get("line_total", 0))

        # Get product names
        if product_stats:
            prod_resp = supabase.table("products") \
                .select("id, name") \
                .in_("id", list(product_stats.keys())) \
                .execute()
            name_map = {p["id"]: p["name"] for p in (prod_resp.data or [])}
        else:
            name_map = {}

        # Build sorted lists
        by_qty = sorted(
            [{"product_id": k, "name": name_map.get(k, "Unknown"), "total_qty": v["qty"], "total_revenue": v["revenue"]}
             for k, v in product_stats.items()],
            key=lambda x: x["total_qty"], reverse=True
        )[:5]

        by_revenue = sorted(
            [{"product_id": k, "name": name_map.get(k, "Unknown"), "total_qty": v["qty"], "total_revenue": v["revenue"]}
             for k, v in product_stats.items()],
            key=lambda x: x["total_revenue"], reverse=True
        )[:5]

        return _response(data={"by_quantity": by_qty, "by_revenue": by_revenue})
    except Exception as e:
        current_app.logger.error("failed to get top products report: %s", e)
        return _response(error=str(e), status=500)


@reports_bp.route("/top-customers", methods=["GET"])
@require_auth
def top_customers():
    """Top 5 customers by total revenue."""
    try:
        resp = supabase.table("invoices") \
            .select("customer_id, total, customers(name, company_name)") \
            .in_("status", ["confirmed", "paid", "partial"]) \
            .execute()

        invoices = resp.data or []

        # Aggregate by customer
        customer_stats = {}
        for inv in invoices:
            cid = inv["customer_id"]
            if cid not in customer_stats:
                customer = inv.get("customers") or {}
                customer_stats[cid] = {
                    "name": customer.get("name", "Unknown"),
                    "company": customer.get("company_name", ""),
                    "total_revenue": 0,
                    "invoice_count": 0,
                }
            customer_stats[cid]["total_revenue"] += float(inv.get("total", 0) or 0)
            customer_stats[cid]["invoice_count"] += 1

        top = sorted(
            [{"customer_id": k, **v} for k, v in customer_stats.items()],
            key=lambda x: x["total_revenue"], reverse=True
        )[:5]

        return _response(data=top)
    except Exception as e:
        current_app.logger.error("failed to get top customers report: %s", e)
        return _response(error=str(e), status=500)


@reports_bp.route("/profit-per-product", methods=["GET"])
@require_auth
def profit_per_product():
    """Profit per product: revenue minus (cost_price × qty_sold)."""
    try:
        # Fetch all sold items
        resp = supabase.table("invoice_items") \
            .select("product_id, qty, line_total, invoices!inner(status)") \
            .in_("invoices.status", ["confirmed", "paid", "partial"]) \
            .execute()

        items = resp.data or []

        # Aggregate sales per product
        product_sales = {}
        for item in items:
            pid = item["product_id"]
            if pid not in product_sales:
                product_sales[pid] = {"qty_sold": 0, "revenue": 0}
            product_sales[pid]["qty_sold"] += float(item.get("qty", 0))
            product_sales[pid]["revenue"] += float(item.get("line_total", 0))

        # Get product details (name, cost_price, packaging info, formulation link)
        if product_sales:
            prod_resp = supabase.table("products") \
                .select("id, name, cost_price, selling_price, packaging_size, formulation_id") \
                .in_("id", list(product_sales.keys())) \
                .execute()
            products = {p["id"]: p for p in (prod_resp.data or [])}
        else:
            products = {}

        # Calculate profit
        result = []
        for pid, stats in product_sales.items():
            prod = products.get(pid, {})
            cost_price = float(prod.get("cost_price", 0) or 0)
            packaging_size = float(prod.get("packaging_size") or 0)

            # For bulk products, cost_price is per package — derive cost per selling unit
            if packaging_size > 0:
                cost_per_unit = cost_price / packaging_size
            else:
                cost_per_unit = cost_price

            total_cost = cost_per_unit * stats["qty_sold"]
            profit = stats["revenue"] - total_cost
            margin = (profit / stats["revenue"] * 100) if stats["revenue"] > 0 else 0

            # Classify: manufactured (has formulation) vs traded (no formulation)
            product_type = "manufactured" if prod.get("formulation_id") else "traded"

            result.append({
                "product_id": pid,
                "name": prod.get("name", "Unknown"),
                "product_type": product_type,
                "qty_sold": stats["qty_sold"],
                "revenue": round(stats["revenue"], 2),
                "total_cost": round(total_cost, 2),
                "profit": round(profit, 2),
                "margin_pct": round(margin, 1),
            })

        result.sort(key=lambda x: x["profit"], reverse=True)
        return _response(data=result)
    except Exception as e:
        current_app.logger.error("failed to get profit per product report: %s", e)
        return _response(error=str(e), status=500)


@reports_bp.route("/consumption", methods=["GET"])
@require_auth
def raw_material_consumption():
    """Raw material consumption over time (from production logs)."""
    try:
        # Get all production logs with their product formulas
        prod_logs = supabase.table("production_log") \
            .select("product_id, batches_produced, produced_date, products(name, formulation_id)") \
            .order("produced_date", desc=True) \
            .limit(100) \
            .execute()

        logs = prod_logs.data or []

        # For each production log, calculate raw material consumption
        consumption = []
        for log in logs:
            product_id = log["product_id"]
            batches = float(log.get("batches_produced", 0))

            products_data = log.get("products") or {}
            formulation_id = products_data.get("formulation_id")

            if formulation_id:
                # Get formulation's ingredient lines
                formula_resp = supabase.table("formulation_ingredients") \
                    .select("raw_material_id, qty_per_batch, raw_materials(name, unit)") \
                    .eq("formulation_id", formulation_id) \
                    .execute()
            else:
                # Fallback to legacy product_formula table
                formula_resp = supabase.table("product_formula") \
                    .select("raw_material_id, qty_per_batch, raw_materials(name, unit)") \
                    .eq("product_id", product_id) \
                    .execute()

            for line in (formula_resp.data or []):
                rm = line.get("raw_materials") or {}
                consumption.append({
                    "date": log.get("produced_date"),
                    "product": products_data.get("name", "Unknown"),
                    "raw_material": rm.get("name", "Unknown"),
                    "unit": rm.get("unit", ""),
                    "qty_consumed": round(float(line["qty_per_batch"]) * batches, 4),
                })

        return _response(data=consumption)
    except Exception as e:
        current_app.logger.error("failed to get consumption report: %s", e)
        return _response(error=str(e), status=500)


@reports_bp.route("/low-stock", methods=["GET"])
@require_auth
def low_stock_summary():
    """Summary of all items below their low-stock threshold."""
    try:
        # Raw materials
        rm_resp = supabase.table("raw_materials") \
            .select("id, name, unit, stock_qty, low_stock_threshold") \
            .execute()
        low_rm = [
            {**item, "type": "raw_material",
             "deficit": round(float(item["low_stock_threshold"]) - float(item["stock_qty"]), 4)}
            for item in (rm_resp.data or [])
            if float(item.get("low_stock_threshold", 0)) > 0
            and float(item.get("stock_qty", 0)) <= float(item.get("low_stock_threshold", 0))
        ]

        # Finished goods
        fg_resp = supabase.table("products") \
            .select("id, name, batch_unit, stock_qty, low_stock_threshold") \
            .execute()
        low_fg = [
            {**item, "type": "finished_good",
             "deficit": round(float(item["low_stock_threshold"]) - float(item["stock_qty"]), 4)}
            for item in (fg_resp.data or [])
            if float(item.get("low_stock_threshold", 0)) > 0
            and float(item.get("stock_qty", 0)) <= float(item.get("low_stock_threshold", 0))
        ]

        return _response(data={
            "raw_materials": low_rm,
            "finished_goods": low_fg,
            "total_alerts": len(low_rm) + len(low_fg),
        })
    except Exception as e:
        current_app.logger.error("failed to get low stock summary: %s", e)
        return _response(error=str(e), status=500)


@reports_bp.route("/valuation", methods=["GET"])
@require_auth
def inventory_valuation():
    """Calculate the total capital sitting in inventory."""
    try:
        # Raw materials valuation
        rm_resp = supabase.table("raw_materials") \
            .select("stock_qty, price_per_unit") \
            .execute()
        
        raw_material_capital = 0.0
        for rm in (rm_resp.data or []):
            qty = float(rm.get("stock_qty") or 0)
            price = float(rm.get("price_per_unit") or 0)
            if qty > 0 and price > 0:
                raw_material_capital += (qty * price)

        # Finished goods valuation
        fg_resp = supabase.table("products") \
            .select("stock_qty, cost_price, packaging_size") \
            .execute()
            
        finished_goods_capital = 0.0
        for fg in (fg_resp.data or []):
            qty = float(fg.get("stock_qty") or 0)
            cost = float(fg.get("cost_price") or 0)
            pkg_size = float(fg.get("packaging_size") or 0)
            
            # If product has a packaging unit, cost_price is the price per package
            unit_cost = (cost / pkg_size) if pkg_size > 0 else cost
            
            if qty > 0 and unit_cost > 0:
                finished_goods_capital += (qty * unit_cost)

        total_capital = raw_material_capital + finished_goods_capital

        return _response(data={
            "raw_material_capital": round(raw_material_capital, 2),
            "finished_goods_capital": round(finished_goods_capital, 2),
            "total_capital": round(total_capital, 2)
        })
    except Exception as e:
        current_app.logger.error("failed to get inventory valuation: %s", e)
        return _response(error=str(e), status=500)

