from config import supabase

def test_purchase():
    print("Testing purchase logic...")
    # Get a product
    resp = supabase.table("products").select("*").limit(1).execute()
    product = resp.data[0]
    pid = product["id"]
    print(f"Product: {product['name']}, Cost: {product['cost_price']}")
    
    # Update cost price
    supabase.table("products").update({"cost_price": 99.99}).eq("id", pid).execute()
    
    # Verify
    resp2 = supabase.table("products").select("cost_price").eq("id", pid).execute()
    print(f"New Cost: {resp2.data[0]['cost_price']}")

test_purchase()
