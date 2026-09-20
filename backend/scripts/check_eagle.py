import os
import sys
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from config import supabase

cats = supabase.table("product_categories").select("*").execute().data
eagle_cat = next((c for c in cats if "eagle" in c["name"].lower()), None)
if eagle_cat:
    print(f"Found category: {eagle_cat['name']} (ID: {eagle_cat['id']})")
    prods = supabase.table("products").select("*").eq("category_id", eagle_cat['id']).execute().data
    print(f"Found {len(prods)} products:")
    for p in prods:
        print(f" - {p['name']} (Size: {p.get('packaging_size')} {p.get('packaging_unit')})")
else:
    print("Category not found! Available categories:")
    for c in cats:
        print(c["name"])
