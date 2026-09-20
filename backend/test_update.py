import requests
import json
import os
from dotenv import load_dotenv

load_dotenv()
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")

from supabase import create_client
supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

# 1. get a product with a formulation_id
prod = supabase.table("products").select("id, name, fill_volume, formulation_id").not_is_null("formulation_id").limit(1).execute()
if not prod.data:
    print("No product found with formulation")
    exit()

product = prod.data[0]
print("Original product:", product)

# 2. update fill volume (simulate PUT)
# We can't easily simulate the auth middleware, so let's just do a direct DB update to see if it allows it.
res = supabase.table("products").update({"fill_volume": 5.5}).eq("id", product["id"]).execute()
print("First Update:", res.data)

res2 = supabase.table("products").update({"fill_volume": 2.2}).eq("id", product["id"]).execute()
print("Second Update:", res2.data)

