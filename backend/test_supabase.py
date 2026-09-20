import sys
import os

from config import supabase

try:
    print("Fetching 2 products...")
    res = supabase.table("products").select("id, stock_qty, name").limit(2).execute()
    products = res.data
    
    for p in products:
        new_qty = float(p["stock_qty"] or 0) + 1
        print(f"Updating {p['name']} to {new_qty}...")
        supabase.table("products").update({"stock_qty": new_qty}).eq("id", p["id"]).execute()
        
    print("Done")
except Exception as e:
    print(f"Error: {e}")

