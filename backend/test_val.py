import os
import sys
from config import supabase

def test():
    # Raw materials valuation
    rm_resp = supabase.table("raw_materials").select("name, stock_qty, price_per_unit").execute()
    for rm in rm_resp.data:
        qty = float(rm.get("stock_qty") or 0)
        price = float(rm.get("price_per_unit") or 0)
        val = qty * price
        if val > 100000:
            print(f"RM: {rm['name']} - Qty: {qty}, Price: {price}, Val: {val}")

    # Finished goods valuation
    fg_resp = supabase.table("products").select("name, stock_qty, cost_price").execute()
    for fg in fg_resp.data:
        qty = float(fg.get("stock_qty") or 0)
        cost = float(fg.get("cost_price") or 0)
        val = qty * cost
        if val > 100000:
            print(f"FG: {fg['name']} - Qty: {qty}, Cost: {cost}, Val: {val}")

test()
