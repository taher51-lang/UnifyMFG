# backend/services/inventory_ledger.py
from config import supabase

def log_stock_change(item_type, item_id, change_amount, new_stock_qty, source, notes=None):
    """
    Log a change in stock to the stock_ledger table.
    
    :param item_type: 'raw_material' or 'product'
    :param item_id: UUID of the item
    :param change_amount: float, amount added (positive) or deducted (negative)
    :param new_stock_qty: float, the resulting total stock quantity
    :param source: string, e.g., 'manual_edit', 'purchase', 'production_consumption', etc.
    :param notes: string, optional extra context
    """
    try:
        row = {
            "item_type": item_type,
            "change_amount": round(float(change_amount), 6),
            "new_stock_qty": round(float(new_stock_qty), 6),
            "source": source,
            "notes": notes or ""
        }
        
        if item_type == "raw_material":
            row["raw_material_id"] = item_id
        elif item_type == "product":
            row["product_id"] = item_id
        else:
            raise ValueError("Invalid item_type for ledger")
            
        supabase.table("stock_ledger").insert(row).execute()
    except Exception as e:
        # We don't want a ledger failure to completely break the primary operation,
        # but we should log it. In a robust system, this might be a fatal error.
        print(f"Failed to log to stock_ledger: {str(e)}")
