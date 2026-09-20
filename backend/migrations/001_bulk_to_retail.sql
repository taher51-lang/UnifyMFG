-- ============================================================================
-- MIGRATION 001: Bulk-to-Retail Repackaging System
-- ============================================================================
-- Run this in Supabase SQL Editor.
-- Adds packaging/unit fields to products and a product purchase log table.
-- ============================================================================

-- ──────────────────────────────────────────────────────────────────────────────
-- 1. Add packaging & unit columns to PRODUCTS
-- ──────────────────────────────────────────────────────────────────────────────
-- selling_unit  → the unit customers buy in ("kg", "g", "L", "pcs")
-- packaging_size → how many selling_units per package (25 for a 25kg bag)
-- packaging_unit → label for the package ("bag", "sack", "drum", "box")
--
-- Semantics:
--   stock_qty     = total stock in selling_unit (e.g., 75 kg)
--   cost_price    = cost per PACKAGE (e.g., ₹800 per bag)
--   wholesale_price = price per selling_unit for wholesale orders
--   retail_price    = price per selling_unit for retail orders
--   Derived cost/unit = cost_price / packaging_size

ALTER TABLE products ADD COLUMN IF NOT EXISTS selling_unit TEXT DEFAULT '';
ALTER TABLE products ADD COLUMN IF NOT EXISTS packaging_size NUMERIC DEFAULT NULL;
ALTER TABLE products ADD COLUMN IF NOT EXISTS packaging_unit TEXT DEFAULT '';


-- ──────────────────────────────────────────────────────────────────────────────
-- 2. Create PRODUCT PURCHASE LOG (buying trading products in bulk)
-- ──────────────────────────────────────────────────────────────────────────────
-- Mirrors purchase_log (for raw materials) but for tradeable/sellable products.
-- When you buy 3 bags of corn flour, this logs it and auto-increments stock.

CREATE TABLE IF NOT EXISTS product_purchase_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    qty_packages NUMERIC NOT NULL,           -- packages bought (e.g., 3 bags)
    qty_units NUMERIC NOT NULL,              -- total selling units added (e.g., 75 kg)
    price_paid NUMERIC DEFAULT 0,            -- total amount paid for this purchase
    supplier TEXT DEFAULT '',
    purchase_date DATE,
    notes TEXT DEFAULT '',
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_product_purchase_log_product ON product_purchase_log(product_id);
ALTER TABLE product_purchase_log ENABLE ROW LEVEL SECURITY;


-- ============================================================================
-- DONE! No data migration needed — existing products will have:
--   selling_unit = ''  (display as-is)
--   packaging_size = NULL (no packaging — treated as individual units)
--   packaging_unit = ''
-- ============================================================================
