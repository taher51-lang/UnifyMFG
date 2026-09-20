import os
import sys

# Add parent directory to path so we can import config and services
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from config import supabase
from services.semantic_search import upsert_product_to_pinecone

# ── Add your product names here ──
PRODUCTS_TO_ADD = [
    "Bluestar liquid colour 500ml Apple Green",
    "Bluestar liquid colour 500ml Blue",
    "Bluestar liquid colour 500ml kesar yellow",
    "Bluestar liquid colour 500ml lemon yellow",
    "Bluestar liquid colour 500ml orange red",
    "Bluestar liquid colour 500ml Chocolate"
    # "Another Product",
]

def main():
    if not PRODUCTS_TO_ADD:
        print("No products to add. Edit the PRODUCTS_TO_ADD list in the script.")
        return

    print(f"Adding {len(PRODUCTS_TO_ADD)} products to the database...")
    
    success_count = 0
    for name in PRODUCTS_TO_ADD:
        try:
            # 1. Insert into Supabase
            # All other fields (category, price, etc.) will default to null/0 per DB schema
            res = supabase.table("products").insert({
                "name": name
            }).execute()
            
            if res.data:
                product_id = res.data[0]["id"]
                print(f"✅ Added to DB: {name} (ID: {product_id})")
                
                # 2. Sync to Pinecone for Semantic Search
                try:
                    upsert_product_to_pinecone(product_id, name)
                    print(f"   ↳ Synced to Pinecone")
                except Exception as e:
                    print(f"   ↳ ⚠ Failed to sync to Pinecone: {e}")
                    
                success_count += 1
            else:
                print(f"❌ Failed to add: {name} (No data returned)")
                
        except Exception as e:
            print(f"❌ Error adding '{name}': {e}")
            
    print(f"\nDone! Successfully added {success_count}/{len(PRODUCTS_TO_ADD)} products.")

if __name__ == "__main__":
    main()
