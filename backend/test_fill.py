import os
import requests
from dotenv import load_dotenv
load_dotenv()

# We'll use supabase directly
from supabase import create_client
supabase = create_client(os.getenv("SUPABASE_URL"), os.getenv("SUPABASE_KEY"))

# Create a dummy formulation
f_res = supabase.table("formulations").insert({"name": "Test Form", "batch_size": 100, "batch_unit": "L"}).execute()
f_id = f_res.data[0]["id"]

# Create a dummy product
p_res = supabase.table("products").insert({
    "name": "Test Product", 
    "formulation_id": f_id,
    "fill_volume": 1.0
}).execute()
p_id = p_res.data[0]["id"]

print("Created product with fill_volume:", p_res.data[0]["fill_volume"])

# Update fill volume to 2.0
u_res = supabase.table("products").update({"fill_volume": 2.0, "formulation_id": f_id}).eq("id", p_id).execute()
print("Updated to 2.0:", u_res.data[0]["fill_volume"])

# Update fill volume to 3.0
u2_res = supabase.table("products").update({"fill_volume": 3.0, "formulation_id": f_id}).eq("id", p_id).execute()
print("Updated to 3.0:", u2_res.data[0]["fill_volume"])

# Clean up
supabase.table("products").delete().eq("id", p_id).execute()
supabase.table("formulations").delete().eq("id", f_id).execute()
