import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))
from config import supabase
from datetime import datetime, timedelta
import random

print("💰 Seeding demo sales data...")

# Fetch customers
customers_resp = supabase.table("customers").select("id").execute()
customer_ids = [c["id"] for c in customers_resp.data]

# Fetch products (need id, wholesale_price)
products_resp = supabase.table("products").select("id, wholesale_price, retail_price").execute()
products = products_resp.data

if not customer_ids or not products:
    print("Error: Need customers and products to create sales.")
    sys.exit(1)

# Generate a few invoices totaling ~15k
# Let's do 4 invoices
invoices_to_create = [
    {
        "status": "paid",
        "items": [
            {"product": products[0], "qty": 10}, # Vanilla 500ml (~140 * 10 = 1400)
            {"product": products[2], "qty": 20}, # Mango 100g (~65 * 20 = 1300)
        ]
    },
    {
        "status": "paid",
        "items": [
            {"product": products[4], "qty": 25}, # Pineapple (~75 * 25 = 1875)
            {"product": products[6], "qty": 15}, # Rose Sherbet (~110 * 15 = 1650)
            {"product": products[8], "qty": 5},  # Caramel (~160 * 5 = 800)
        ]
    },
    {
        "status": "paid",
        "items": [
            {"product": products[1], "qty": 12}, # Vanilla 1L (~250 * 12 = 3000)
            {"product": products[5], "qty": 40}, # Peppermint (~55 * 40 = 2200)
        ]
    },
    {
        "status": "partial",
        "amount_paid": 1000,
        "items": [
            {"product": products[7], "qty": 20}, # Strawberry (~90 * 20 = 1800)
            {"product": products[3], "qty": 5},  # Mango 500g (~280 * 5 = 1400)
        ]
    }
]

# Total calculated above:
# Inv 1: 2700
# Inv 2: 4325
# Inv 3: 5200
# Inv 4: 3200
# Total: ~15,425

total_sales = 0

for i, inv_data in enumerate(invoices_to_create):
    subtotal = 0
    item_rows = []
    
    # Calculate subtotal and build items
    for item in inv_data["items"]:
        qty = item["qty"]
        price = item["product"]["wholesale_price"]
        line_total = qty * price
        subtotal += line_total
        item_rows.append({
            "product_id": item["product"]["id"],
            "qty": qty,
            "unit_price": price,
            "line_total": line_total
        })
    
    total = subtotal # Assuming 0% tax/discount for simplicity
    total_sales += total

    # Insert invoice
    invoice_num = f"INV-10{i+1}"
    date_obj = datetime.now() - timedelta(days=random.randint(1, 10))
    
    invoice_row = {
        "invoice_number": invoice_num,
        "customer_id": random.choice(customer_ids),
        "invoice_date": date_obj.strftime("%Y-%m-%d"),
        "due_date": (date_obj + timedelta(days=15)).strftime("%Y-%m-%d"),
        "status": inv_data["status"],
        "subtotal": subtotal,
        "total": total,
        "amount_paid": inv_data.get("amount_paid", total) if inv_data["status"] == "paid" or "amount_paid" in inv_data else 0,
        "notes": "Generated demo invoice"
    }
    
    inv_resp = supabase.table("invoices").insert(invoice_row).execute()
    new_inv_id = inv_resp.data[0]["id"]
    
    # Add invoice_id to items and insert
    for r in item_rows:
        r["invoice_id"] = new_inv_id
        
    supabase.table("invoice_items").insert(item_rows).execute()
    print(f"  ✅ Inserted {invoice_num} for ₹{total}")

print(f"\n🎉 Successfully created 4 invoices totaling ₹{total_sales:,.2f}")
