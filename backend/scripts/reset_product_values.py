#!/usr/bin/env python3
"""
reset_product_values.py

Resets cost_price, wholesale_price, retail_price, selling_price, stock_qty,
and formulation linkage to 0/NULL across products, while preserving product
names and categories.

Features:
- Automatic JSON backup before applying any changes
- Interactive confirmation prompt or --execute / --dry-run CLI flags
- Optional --reset-formulations flag to also zero-out formulation costs
"""

import os
import sys
import json
import argparse
from datetime import datetime

# Add backend root to path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from config import supabase

def backup_products(products):
    """Saves current products state to a timestamped JSON file."""
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    backup_file = os.path.join(
        os.path.dirname(os.path.abspath(__file__)),
        f"products_backup_{timestamp}.json"
    )
    with open(backup_file, "w", encoding="utf-8") as f:
        json.dump(products, f, indent=2, default=str)
    print(f"📦 Safety backup created at: {backup_file}")
    return backup_file

def main():
    parser = argparse.ArgumentParser(
        description="Default product costs, wholesale, retail, stock, and formulation to 0 (keeps name & category)."
    )
    parser.add_argument("--execute", action="store_true", help="Execute the update directly without interactive prompt")
    parser.add_argument("--dry-run", action="store_true", help="Perform a dry run preview without modifying any data")
    parser.add_argument("--reset-formulations", action="store_true", help="Also set cost_price to 0 on the formulations table")
    args = parser.parse_args()

    print("=" * 70)
    print(" 🔄 PRODUCT VALUES RESET SCRIPT")
    print("=" * 70)

    # 1. Fetch all products
    print("Fetching products from database...")
    all_products = []
    page_size = 1000
    start = 0
    while True:
        resp = supabase.table("products").select("*").range(start, start + page_size - 1).execute()
        rows = resp.data or []
        all_products.extend(rows)
        if len(rows) < page_size:
            break
        start += page_size

    total_count = len(all_products)
    print(f"Found {total_count} total products.")

    # 2. Identify products that actually have non-zero or non-null values to reset
    to_reset = []
    for p in all_products:
        has_cost = float(p.get("cost_price") or 0) != 0
        has_wholesale = float(p.get("wholesale_price") or 0) != 0
        has_retail = float(p.get("retail_price") or 0) != 0
        has_selling = float(p.get("selling_price") or 0) != 0
        has_stock = float(p.get("stock_qty") or 0) != 0
        has_formulation = p.get("formulation_id") is not None
        has_fill_volume = p.get("fill_volume") is not None

        if any([has_cost, has_wholesale, has_retail, has_selling, has_stock, has_formulation, has_fill_volume]):
            to_reset.append(p)

    print(f"Products with values to be reset: {len(to_reset)} of {total_count}")
    print("\nColumns that will be reset to 0 / NULL:")
    print("  • cost_price        -> 0")
    print("  • wholesale_price   -> 0")
    print("  • retail_price      -> 0")
    print("  • selling_price     -> 0")
    print("  • stock_qty         -> 0")
    print("  • formulation_id    -> NULL")
    print("  • fill_volume       -> NULL")
    print("\nColumns that will be PRESERVED:")
    print("  ✓ id")
    print("  ✓ name (Product Name)")
    print("  ✓ category_id (Category)")
    print("  ✓ packaging_size, packaging_unit, selling_unit, description, suppliers")

    if args.reset_formulations:
        print("\nFormulations table:")
        print("  • cost_price        -> 0")

    print("-" * 70)

    # 3. Dry run mode
    if args.dry_run:
        print("🔍 DRY RUN ONLY: No changes were made to the database.")
        print("To apply changes, run again with --execute or without --dry-run.")
        return

    # 4. Confirmation check
    if not args.execute:
        confirm = input(f"\n⚠️  Are you sure you want to reset {total_count} products? Type 'yes' to proceed: ").strip().lower()
        if confirm != "yes":
            print("❌ Operation cancelled. No changes made.")
            return

    # 5. Create backup first
    backup_products(all_products)

    # 6. Apply updates in batches
    print("\nUpdating products in database...")
    update_payload = {
        "cost_price": 0,
        "wholesale_price": 0,
        "retail_price": 0,
        "selling_price": 0,
        "stock_qty": 0,
        "formulation_id": None,
        "fill_volume": None
    }

    # Supabase allows bulk update with a filter
    # Using neq id '00000000-0000-0000-0000-000000000000' matches all rows
    try:
        # Update in batches of 200 IDs for reliability and speed
        batch_size = 200
        updated_count = 0
        for i in range(0, total_count, batch_size):
            batch_ids = [p["id"] for p in all_products[i:i + batch_size]]
            resp = supabase.table("products").update(update_payload).in_("id", batch_ids).execute()
            updated_count += len(resp.data or [])
            print(f"  Updated batch {i // batch_size + 1} ({updated_count}/{total_count} products)...")

        print(f"\n✅ Successfully reset {updated_count} products!")
    except Exception as e:
        print(f"\n❌ Error updating products: {e}")
        return

    # 7. Optionally reset formulations table cost_price
    if args.reset_formulations:
        print("\nResetting cost_price on formulations table...")
        try:
            forms_resp = supabase.table("formulations").select("id").execute()
            form_ids = [f["id"] for f in (forms_resp.data or [])]
            if form_ids:
                supabase.table("formulations").update({"cost_price": 0}).in_("id", form_ids).execute()
                print(f"✅ Reset cost_price to 0 on {len(form_ids)} formulations.")
        except Exception as e:
            print(f"❌ Error updating formulations: {e}")

    print("=" * 70)
    print(" 🎉 DONE! Product names and categories are intact, all other target values set to 0.")
    print("=" * 70)

if __name__ == "__main__":
    main()
