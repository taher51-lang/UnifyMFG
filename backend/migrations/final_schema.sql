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
-- ============================================================================
-- MIGRATION 002: Compound Products as Ingredients (Multi-Level Formulations)
-- ============================================================================
-- Allows formulation_ingredients to reference either a raw_material OR a product
-- (compound/intermediate product from another formulation).
-- ============================================================================

-- 1. Make raw_material_id nullable (was NOT NULL)
ALTER TABLE formulation_ingredients
  ALTER COLUMN raw_material_id DROP NOT NULL;

-- 2. Add product_id column for compound ingredients
ALTER TABLE formulation_ingredients
  ADD COLUMN product_id uuid REFERENCES products(id) ON DELETE SET NULL;

-- 3. Ensure exactly one source is set per line (XOR constraint)
ALTER TABLE formulation_ingredients
  ADD CONSTRAINT chk_ingredient_type
  CHECK (
    (raw_material_id IS NOT NULL AND product_id IS NULL) OR
    (raw_material_id IS NULL AND product_id IS NOT NULL)
  );
-- ============================================================================
-- MIGRATION 003: Inventory Ledger (Stock Tracker)
-- ============================================================================

CREATE TABLE stock_ledger (
    id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    item_type text NOT NULL CHECK (item_type IN ('raw_material', 'product')),
    raw_material_id uuid REFERENCES raw_materials(id) ON DELETE CASCADE,
    product_id uuid REFERENCES products(id) ON DELETE CASCADE,
    change_amount numeric NOT NULL,
    new_stock_qty numeric NOT NULL,
    source text NOT NULL,
    notes text,
    
    CONSTRAINT chk_ledger_item CHECK (
        (item_type = 'raw_material' AND raw_material_id IS NOT NULL AND product_id IS NULL) OR
        (item_type = 'product' AND product_id IS NOT NULL AND raw_material_id IS NULL)
    )
);

-- Indexes for fast querying
CREATE INDEX idx_stock_ledger_raw_material ON stock_ledger(raw_material_id);
CREATE INDEX idx_stock_ledger_product ON stock_ledger(product_id);
CREATE INDEX idx_stock_ledger_created_at ON stock_ledger(created_at DESC);

-- Optional: Initialize baseline stock for existing items
INSERT INTO stock_ledger (item_type, raw_material_id, change_amount, new_stock_qty, source, notes)
SELECT 'raw_material', id, stock_qty, stock_qty, 'initialization', 'Baseline stock logged via migration'
FROM raw_materials
WHERE stock_qty > 0;

INSERT INTO stock_ledger (item_type, product_id, change_amount, new_stock_qty, source, notes)
SELECT 'product', id, stock_qty, stock_qty, 'initialization', 'Baseline stock logged via migration'
FROM products
WHERE stock_qty > 0;
