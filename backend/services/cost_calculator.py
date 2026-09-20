# backend/services/cost_calculator.py
# Cost recalculation for formulations and products.
# Supports both raw material and compound product ingredients.

from config import supabase


def calculate_cost_price(formula_lines):
    """
    Calculate total cost price from a list of formula/ingredient lines.
    Each line: { qty_per_batch, price_per_unit }
    """
    total = 0.0
    for line in formula_lines:
        qty = float(line.get("qty_per_batch", 0))
        price = float(line.get("price_per_unit", 0))
        total += qty * price
    return round(total, 4)


# ═══════════════════════════════════════════════════════════════════════
# FORMULATION COST (supports raw materials + compound products)
# ═══════════════════════════════════════════════════════════════════════

def recalculate_formulation_cost(formulation_id, _visited=None):
    """
    Recalculate the cost price for a formulation from its ingredients.
    Handles both raw material ingredients and compound product ingredients.
    Then cascade to update cost_price on all products linked to this formulation.
    
    Uses _visited set for cycle detection to prevent infinite loops.
    Returns the new formulation batch cost_price.
    """
    # Cycle detection
    if _visited is None:
        _visited = set()
    if formulation_id in _visited:
        print(f"WARNING: Circular dependency detected for formulation {formulation_id}. Skipping.")
        return 0.0
    _visited.add(formulation_id)

    # 1. Fetch all ingredient lines (may have raw_material_id OR product_id)
    ing_resp = supabase.table("formulation_ingredients") \
        .select("qty_per_batch, raw_material_id, product_id") \
        .eq("formulation_id", formulation_id) \
        .execute()

    ingredients = ing_resp.data or []

    if not ingredients:
        supabase.table("formulations").update({"cost_price": 0}).eq("id", formulation_id).execute()
        _cascade_formulation_cost_to_products(formulation_id, 0, None, _visited)
        return 0.0

    # 2. Separate raw material vs compound product ingredients
    rm_ingredients = [i for i in ingredients if i.get("raw_material_id")]
    product_ingredients = [i for i in ingredients if i.get("product_id")]

    batch_cost = 0.0

    # 3a. Raw material cost (unchanged logic)
    if rm_ingredients:
        rm_ids = [i["raw_material_id"] for i in rm_ingredients]
        rm_resp = supabase.table("raw_materials") \
            .select("id, price_per_unit") \
            .in_("id", rm_ids) \
            .execute()
        price_map = {rm["id"]: float(rm["price_per_unit"]) for rm in (rm_resp.data or [])}

        batch_cost += sum(
            float(i["qty_per_batch"]) * price_map.get(i["raw_material_id"], 0)
            for i in rm_ingredients
        )

    # 3b. Compound product cost (NEW)
    if product_ingredients:
        prod_ids = [i["product_id"] for i in product_ingredients]
        prod_resp = supabase.table("products") \
            .select("id, cost_price, packaging_size") \
            .in_("id", prod_ids) \
            .execute()
        
        prod_map = {p["id"]: p for p in (prod_resp.data or [])}

        for i in product_ingredients:
            p = prod_map.get(i["product_id"])
            if not p: continue
            
            cost = float(p.get("cost_price") or 0)
            pkg_size = float(p.get("packaging_size") or 0)
            
            # If product has a packaging size, cost_price is the price per package
            unit_cost = (cost / pkg_size) if pkg_size > 0 else cost
            
            batch_cost += float(i["qty_per_batch"]) * unit_cost

    batch_cost = round(batch_cost, 4)

    # 4. Persist on formulation
    supabase.table("formulations") \
        .update({"cost_price": batch_cost}) \
        .eq("id", formulation_id) \
        .execute()

    # 5. Fetch batch_size so we can derive per-unit costs
    form_resp = supabase.table("formulations") \
        .select("batch_size") \
        .eq("id", formulation_id) \
        .single() \
        .execute()
    batch_size = float((form_resp.data or {}).get("batch_size") or 0)

    # 6. Cascade to linked products
    _cascade_formulation_cost_to_products(formulation_id, batch_cost, batch_size, _visited)

    return batch_cost


def _cascade_formulation_cost_to_products(formulation_id, batch_cost, batch_size, _visited=None):
    """
    For every product linked to this formulation, derive its cost_price as:
        cost_price = (batch_cost / batch_size) * fill_volume
    Then check if any of those products are used as compound ingredients in other
    formulations and cascade their cost updates too.
    """
    if _visited is None:
        _visited = set()

    prod_resp = supabase.table("products") \
        .select("id, fill_volume") \
        .eq("formulation_id", formulation_id) \
        .execute()

    for product in (prod_resp.data or []):
        fill_volume = float(product.get("fill_volume") or 0)
        if batch_size and batch_size > 0 and fill_volume > 0:
            cost_per_unit = round((batch_cost / batch_size) * fill_volume, 4)
        else:
            cost_per_unit = 0.0
        supabase.table("products") \
            .update({"cost_price": cost_per_unit}) \
            .eq("id", product["id"]) \
            .execute()

        # NEW: If this product is used as a compound ingredient in other formulations,
        # cascade the cost update to those formulations too
        _cascade_product_cost_to_formulations(product["id"], _visited)


def _cascade_product_cost_to_formulations(product_id, _visited=None):
    """
    When a compound product's cost changes, recalculate any formulation
    that uses it as an ingredient.
    """
    if _visited is None:
        _visited = set()

    fi_resp = supabase.table("formulation_ingredients") \
        .select("formulation_id") \
        .eq("product_id", product_id) \
        .execute()

    formulation_ids = list(set(r["formulation_id"] for r in (fi_resp.data or [])))
    for fid in formulation_ids:
        recalculate_formulation_cost(fid, _visited)


# ═══════════════════════════════════════════════════════════════════════
# LEGACY PRODUCT FORMULA COST (kept for backward compatibility)
# Products without a formulation_id still use product_formula directly.
# ═══════════════════════════════════════════════════════════════════════

def recalculate_product_cost(product_id):
    """
    Recalculate cost for a product using the legacy product_formula table.
    Only used when product has no formulation_id.
    """
    formula_resp = supabase.table("product_formula") \
        .select("qty_per_batch, raw_material_id") \
        .eq("product_id", product_id) \
        .execute()

    formula_lines = formula_resp.data or []

    if not formula_lines:
        supabase.table("products").update({"cost_price": 0}).eq("id", product_id).execute()
        return 0.0

    rm_ids = [line["raw_material_id"] for line in formula_lines]
    rm_resp = supabase.table("raw_materials") \
        .select("id, price_per_unit") \
        .in_("id", rm_ids) \
        .execute()
    price_map = {rm["id"]: float(rm["price_per_unit"]) for rm in (rm_resp.data or [])}

    total_cost = sum(
        float(line["qty_per_batch"]) * price_map.get(line["raw_material_id"], 0)
        for line in formula_lines
    )
    total_cost = round(total_cost, 4)

    supabase.table("products") \
        .update({"cost_price": total_cost}) \
        .eq("id", product_id) \
        .execute()

    return total_cost


def recalculate_all_affected_products(raw_material_id):
    """
    When a raw material price changes, recalculate:
    1. All formulations that use it → which cascades to linked products
       → which cascades to formulations using those products as compounds
    2. All legacy products (product_formula) that use it directly
    """
    results = []

    # 1. Formulations using this raw material
    fi_resp = supabase.table("formulation_ingredients") \
        .select("formulation_id") \
        .eq("raw_material_id", raw_material_id) \
        .execute()
    formulation_ids = list(set(r["formulation_id"] for r in (fi_resp.data or [])))
    for fid in formulation_ids:
        recalculate_formulation_cost(fid)

    # 2. Legacy products using this raw material directly
    formula_resp = supabase.table("product_formula") \
        .select("product_id") \
        .eq("raw_material_id", raw_material_id) \
        .execute()
    product_ids = list(set(line["product_id"] for line in (formula_resp.data or [])))
    for pid in product_ids:
        new_cost = recalculate_product_cost(pid)
        results.append((pid, new_cost))

    return results
