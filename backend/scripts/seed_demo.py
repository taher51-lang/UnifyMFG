import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))
from config import supabase

print("🌱 Seeding demo data...")

# ── 1. RAW MATERIALS ──
raw_materials = [
    {"name": "Ethanol (Food Grade)", "unit": "L", "price_per_unit": 120, "stock_qty": 500, "low_stock_threshold": 50, "description": "Solvent for flavour extraction", "supplier_name": "ChemPure Industries"},
    {"name": "Vanillin Powder", "unit": "kg", "price_per_unit": 2800, "stock_qty": 45, "low_stock_threshold": 10, "description": "Synthetic vanilla flavouring agent", "supplier_name": "Aarti Chemicals"},
    {"name": "Citric Acid", "unit": "kg", "price_per_unit": 180, "stock_qty": 200, "low_stock_threshold": 30, "description": "Acidulant and preservative", "supplier_name": "Weifang Ensign"},
    {"name": "Propylene Glycol (PG)", "unit": "L", "price_per_unit": 350, "stock_qty": 300, "low_stock_threshold": 40, "description": "Flavour carrier and solvent", "supplier_name": "Dow Chemical"},
    {"name": "Menthol Crystals", "unit": "kg", "price_per_unit": 1600, "stock_qty": 25, "low_stock_threshold": 5, "description": "Cooling agent for mint flavours", "supplier_name": "Bhagat Aromatics"},
    {"name": "Rose Oil (Absolute)", "unit": "kg", "price_per_unit": 42000, "stock_qty": 3, "low_stock_threshold": 1, "description": "Natural rose extract for premium fragrances", "supplier_name": "Ultra International"},
    {"name": "Liquid Glucose", "unit": "kg", "price_per_unit": 65, "stock_qty": 800, "low_stock_threshold": 100, "description": "Sweetener and viscosity agent", "supplier_name": "Sukhjit Starch"},
    {"name": "Sodium Benzoate", "unit": "kg", "price_per_unit": 220, "stock_qty": 150, "low_stock_threshold": 20, "description": "Preservative (E211)", "supplier_name": "Ganesh Benzoplast"},
    {"name": "Tartaric Acid", "unit": "kg", "price_per_unit": 340, "stock_qty": 80, "low_stock_threshold": 15, "description": "Acidulant for grape and wine flavours", "supplier_name": "Changmao Biochemical"},
    {"name": "Pineapple Oleoresin", "unit": "kg", "price_per_unit": 3200, "stock_qty": 12, "low_stock_threshold": 3, "description": "Concentrated pineapple extract", "supplier_name": "Synthite Industries"},
    {"name": "Mango Oleoresin", "unit": "kg", "price_per_unit": 3800, "stock_qty": 8, "low_stock_threshold": 2, "description": "Concentrated mango extract", "supplier_name": "Synthite Industries"},
    {"name": "Strawberry Extract", "unit": "kg", "price_per_unit": 2400, "stock_qty": 15, "low_stock_threshold": 3, "description": "Natural strawberry flavour extract", "supplier_name": "Firmenich SA"},
    {"name": "Gum Arabic", "unit": "kg", "price_per_unit": 450, "stock_qty": 60, "low_stock_threshold": 10, "description": "Emulsifier and stabilizer", "supplier_name": "Agrigum International"},
    {"name": "Titanium Dioxide (E171)", "unit": "kg", "price_per_unit": 520, "stock_qty": 40, "low_stock_threshold": 8, "description": "White pigment for food colouring", "supplier_name": "Lomon Billions"},
    {"name": "Caramel Colour (E150d)", "unit": "L", "price_per_unit": 280, "stock_qty": 100, "low_stock_threshold": 15, "description": "Brown food colouring", "supplier_name": "DDW The Colour House"},
]

rm_resp = supabase.table("raw_materials").insert(raw_materials).execute()
rm_map = {r["name"]: r["id"] for r in rm_resp.data}
print(f"  ✅ {len(rm_resp.data)} raw materials inserted")

# ── 2. FORMULATIONS (Recipes / BOMs) ──
formulations = [
    {"name": "Vanilla Essence Compound", "batch_size": 100, "batch_unit": "L", "cost_price": 0},
    {"name": "Mango Flavour Concentrate", "batch_size": 50, "batch_unit": "kg", "cost_price": 0},
    {"name": "Pineapple Crush Flavour", "batch_size": 50, "batch_unit": "kg", "cost_price": 0},
    {"name": "Peppermint Cool Blend", "batch_size": 25, "batch_unit": "kg", "cost_price": 0},
    {"name": "Rose Sherbet Premix", "batch_size": 100, "batch_unit": "kg", "cost_price": 0},
    {"name": "Strawberry Milk Flavour", "batch_size": 50, "batch_unit": "L", "cost_price": 0},
    {"name": "Caramel Toffee Base", "batch_size": 100, "batch_unit": "kg", "cost_price": 0},
]

fm_resp = supabase.table("formulations").insert(formulations).execute()
fm_map = {f["name"]: f["id"] for f in fm_resp.data}
print(f"  ✅ {len(fm_resp.data)} formulations inserted")

# ── 3. FORMULATION INGREDIENTS (BOM lines) ──
ingredients = [
    # Vanilla Essence
    {"formulation_id": fm_map["Vanilla Essence Compound"], "raw_material_id": rm_map["Ethanol (Food Grade)"], "qty_per_batch": 60},
    {"formulation_id": fm_map["Vanilla Essence Compound"], "raw_material_id": rm_map["Vanillin Powder"], "qty_per_batch": 5},
    {"formulation_id": fm_map["Vanilla Essence Compound"], "raw_material_id": rm_map["Propylene Glycol (PG)"], "qty_per_batch": 30},
    {"formulation_id": fm_map["Vanilla Essence Compound"], "raw_material_id": rm_map["Sodium Benzoate"], "qty_per_batch": 0.5},
    # Mango Flavour
    {"formulation_id": fm_map["Mango Flavour Concentrate"], "raw_material_id": rm_map["Mango Oleoresin"], "qty_per_batch": 8},
    {"formulation_id": fm_map["Mango Flavour Concentrate"], "raw_material_id": rm_map["Propylene Glycol (PG)"], "qty_per_batch": 20},
    {"formulation_id": fm_map["Mango Flavour Concentrate"], "raw_material_id": rm_map["Citric Acid"], "qty_per_batch": 3},
    {"formulation_id": fm_map["Mango Flavour Concentrate"], "raw_material_id": rm_map["Liquid Glucose"], "qty_per_batch": 15},
    # Pineapple Crush
    {"formulation_id": fm_map["Pineapple Crush Flavour"], "raw_material_id": rm_map["Pineapple Oleoresin"], "qty_per_batch": 6},
    {"formulation_id": fm_map["Pineapple Crush Flavour"], "raw_material_id": rm_map["Citric Acid"], "qty_per_batch": 4},
    {"formulation_id": fm_map["Pineapple Crush Flavour"], "raw_material_id": rm_map["Propylene Glycol (PG)"], "qty_per_batch": 18},
    {"formulation_id": fm_map["Pineapple Crush Flavour"], "raw_material_id": rm_map["Sodium Benzoate"], "qty_per_batch": 0.4},
    # Peppermint Cool
    {"formulation_id": fm_map["Peppermint Cool Blend"], "raw_material_id": rm_map["Menthol Crystals"], "qty_per_batch": 8},
    {"formulation_id": fm_map["Peppermint Cool Blend"], "raw_material_id": rm_map["Ethanol (Food Grade)"], "qty_per_batch": 10},
    {"formulation_id": fm_map["Peppermint Cool Blend"], "raw_material_id": rm_map["Propylene Glycol (PG)"], "qty_per_batch": 5},
    # Rose Sherbet
    {"formulation_id": fm_map["Rose Sherbet Premix"], "raw_material_id": rm_map["Rose Oil (Absolute)"], "qty_per_batch": 0.5},
    {"formulation_id": fm_map["Rose Sherbet Premix"], "raw_material_id": rm_map["Citric Acid"], "qty_per_batch": 15},
    {"formulation_id": fm_map["Rose Sherbet Premix"], "raw_material_id": rm_map["Liquid Glucose"], "qty_per_batch": 60},
    {"formulation_id": fm_map["Rose Sherbet Premix"], "raw_material_id": rm_map["Titanium Dioxide (E171)"], "qty_per_batch": 0.3},
    # Strawberry Milk
    {"formulation_id": fm_map["Strawberry Milk Flavour"], "raw_material_id": rm_map["Strawberry Extract"], "qty_per_batch": 10},
    {"formulation_id": fm_map["Strawberry Milk Flavour"], "raw_material_id": rm_map["Propylene Glycol (PG)"], "qty_per_batch": 15},
    {"formulation_id": fm_map["Strawberry Milk Flavour"], "raw_material_id": rm_map["Liquid Glucose"], "qty_per_batch": 20},
    {"formulation_id": fm_map["Strawberry Milk Flavour"], "raw_material_id": rm_map["Citric Acid"], "qty_per_batch": 1},
    # Caramel Toffee
    {"formulation_id": fm_map["Caramel Toffee Base"], "raw_material_id": rm_map["Liquid Glucose"], "qty_per_batch": 50},
    {"formulation_id": fm_map["Caramel Toffee Base"], "raw_material_id": rm_map["Caramel Colour (E150d)"], "qty_per_batch": 8},
    {"formulation_id": fm_map["Caramel Toffee Base"], "raw_material_id": rm_map["Vanillin Powder"], "qty_per_batch": 2},
    {"formulation_id": fm_map["Caramel Toffee Base"], "raw_material_id": rm_map["Gum Arabic"], "qty_per_batch": 5},
]

ing_resp = supabase.table("formulation_ingredients").insert(ingredients).execute()
print(f"  ✅ {len(ing_resp.data)} formulation ingredients inserted")

# ── 4. PRODUCTS (Finished Goods) ──
products = [
    {"name": "Vanilla Essence 500ml", "formulation_id": fm_map["Vanilla Essence Compound"], "stock_qty": 120, "cost_price": 850, "wholesale_price": 140, "retail_price": 180, "selling_unit": "bottle", "packaging_size": 1, "packaging_unit": "bottle"},
    {"name": "Vanilla Essence 1L", "formulation_id": fm_map["Vanilla Essence Compound"], "stock_qty": 60, "cost_price": 1500, "wholesale_price": 250, "retail_price": 320, "selling_unit": "bottle", "packaging_size": 1, "packaging_unit": "bottle"},
    {"name": "Mango Flavour 100g", "formulation_id": fm_map["Mango Flavour Concentrate"], "stock_qty": 200, "cost_price": 380, "wholesale_price": 65, "retail_price": 85, "selling_unit": "pack", "packaging_size": 1, "packaging_unit": "pack"},
    {"name": "Mango Flavour 500g", "formulation_id": fm_map["Mango Flavour Concentrate"], "stock_qty": 80, "cost_price": 1600, "wholesale_price": 280, "retail_price": 350, "selling_unit": "jar", "packaging_size": 1, "packaging_unit": "jar"},
    {"name": "Pineapple Crush 250ml", "formulation_id": fm_map["Pineapple Crush Flavour"], "stock_qty": 150, "cost_price": 420, "wholesale_price": 75, "retail_price": 95, "selling_unit": "bottle", "packaging_size": 1, "packaging_unit": "bottle"},
    {"name": "Peppermint Oil 50ml", "formulation_id": fm_map["Peppermint Cool Blend"], "stock_qty": 300, "cost_price": 280, "wholesale_price": 55, "retail_price": 75, "selling_unit": "bottle", "packaging_size": 1, "packaging_unit": "bottle"},
    {"name": "Rose Sherbet 200g", "formulation_id": fm_map["Rose Sherbet Premix"], "stock_qty": 90, "cost_price": 650, "wholesale_price": 110, "retail_price": 145, "selling_unit": "pack", "packaging_size": 1, "packaging_unit": "pack"},
    {"name": "Strawberry Milk Flavour 250ml", "formulation_id": fm_map["Strawberry Milk Flavour"], "stock_qty": 110, "cost_price": 520, "wholesale_price": 90, "retail_price": 120, "selling_unit": "bottle", "packaging_size": 1, "packaging_unit": "bottle"},
    {"name": "Caramel Toffee Flavour 1kg", "formulation_id": fm_map["Caramel Toffee Base"], "stock_qty": 45, "cost_price": 950, "wholesale_price": 160, "retail_price": 210, "selling_unit": "jar", "packaging_size": 1, "packaging_unit": "jar"},
    {"name": "Blue Star Pineapple Color 100g", "formulation_id": None, "stock_qty": 500, "cost_price": 120, "wholesale_price": 22, "retail_price": 30, "selling_unit": "pack", "packaging_size": 25, "packaging_unit": "box"},
    {"name": "Liquid Glucose 300ml (Trading)", "formulation_id": None, "stock_qty": 250, "cost_price": 45, "wholesale_price": 12, "retail_price": 18, "selling_unit": "bottle", "packaging_size": 12, "packaging_unit": "carton"},
]

prod_resp = supabase.table("products").insert(products).execute()
prod_map = {p["name"]: p["id"] for p in prod_resp.data}
print(f"  ✅ {len(prod_resp.data)} products inserted")

# ── 5. CUSTOMERS ──
customers = [
    {"name": "Bombay Sweets & Co.", "phone": "9876543210", "email": "orders@bombaysweets.in", "address": "Plot 12, MIDC Andheri East, Mumbai 400093", "gst_number": "27AABCB1234F1ZP"},
    {"name": "Royal Bakery", "phone": "9123456789", "email": "purchase@royalbakery.com", "address": "15 MG Road, Pune 411001", "gst_number": "27AADCR5678G1ZQ"},
    {"name": "Freshco Beverages Pvt Ltd", "phone": "9988776655", "email": "procurement@freshco.in", "address": "Unit 8, Industrial Area Phase 2, Ahmedabad 380015", "gst_number": "24AABCF9012H1ZR"},
    {"name": "Kesar Dairy & Foods", "phone": "9871234567", "email": "info@kesardairy.com", "address": "Survey No 45, Sanand GIDC, Gujarat 382110", "gst_number": "24AABCK3456I1ZS"},
    {"name": "Spice Junction Exports", "phone": "9654321098", "email": "export@spicejunction.com", "address": "SEZ Tower, Kandla Port, Gujarat 370230", "gst_number": "24AABCS7890J1ZT"},
    {"name": "Mithai Palace", "phone": "9845612378", "email": "buy@mithaipalace.in", "address": "Shop 3, Lajpat Nagar, New Delhi 110024", "gst_number": "07AABCM2345K1ZU"},
]

cust_resp = supabase.table("customers").insert(customers).execute()
print(f"  ✅ {len(cust_resp.data)} customers inserted")

print("\n🎉 Demo data seeded successfully!")
