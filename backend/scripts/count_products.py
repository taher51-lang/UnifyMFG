import os
import sys
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from config import supabase

prods = supabase.table("products").select("id").execute().data
print(f"Total products fetched: {len(prods)}")
