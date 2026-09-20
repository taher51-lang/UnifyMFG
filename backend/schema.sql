-- ============================================================================
-- FLAVOUR ERP — Full Database Schema
-- ============================================================================
-- Run this SQL in a new Supabase project's SQL Editor to recreate all tables.
-- Then import the CSV backups via Table Editor → Import CSV.
--
-- Generated from codebase analysis. Tables are ordered to respect foreign keys.
-- ============================================================================

-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ──────────────────────────────────────────────────────────────────────────────
-- 1. RAW MATERIALS
-- ──────────────────────────────────────────────────────────────────────────────
CREATE TABLE raw_materials (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT DEFAULT '',
    unit TEXT NOT NULL,                          -- kg, g, ml, L, pcs, oz, lb
    price_per_unit NUMERIC NOT NULL DEFAULT 0,
    stock_qty NUMERIC NOT NULL DEFAULT 0,
    low_stock_threshold NUMERIC NOT NULL DEFAULT 0,
    supplier_name TEXT DEFAULT '',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- ──────────────────────────────────────────────────────────────────────────────
-- 2. RAW MATERIAL PRICE HISTORY (tracks price changes)
-- ──────────────────────────────────────────────────────────────────────────────
CREATE TABLE raw_material_price_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    raw_material_id UUID NOT NULL REFERENCES raw_materials(id) ON DELETE CASCADE,
    old_price NUMERIC NOT NULL,
    new_price NUMERIC NOT NULL,
    changed_at TIMESTAMPTZ DEFAULT now()
);

-- ──────────────────────────────────────────────────────────────────────────────
-- 3. PRODUCT CATEGORIES
-- ──────────────────────────────────────────────────────────────────────────────
CREATE TABLE product_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- ──────────────────────────────────────────────────────────────────────────────
-- 4. FORMULATIONS (recipes / formulas)
-- ──────────────────────────────────────────────────────────────────────────────
CREATE TABLE formulations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT DEFAULT '',
    batch_size NUMERIC,
    batch_unit TEXT,
    cost_price NUMERIC DEFAULT 0,
    image_url TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- ──────────────────────────────────────────────────────────────────────────────
-- 5. FORMULATION INGREDIENTS (recipe lines)
-- ──────────────────────────────────────────────────────────────────────────────
CREATE TABLE formulation_ingredients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    formulation_id UUID NOT NULL REFERENCES formulations(id) ON DELETE CASCADE,
    raw_material_id UUID NOT NULL REFERENCES raw_materials(id) ON DELETE CASCADE,
    qty_per_batch NUMERIC NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- ──────────────────────────────────────────────────────────────────────────────
-- 6. PRODUCTS (finished goods)
-- ──────────────────────────────────────────────────────────────────────────────
CREATE TABLE products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    category_id UUID REFERENCES product_categories(id) ON DELETE SET NULL,
    description TEXT DEFAULT '',
    batch_size NUMERIC,
    batch_unit TEXT,
    formulation_id UUID REFERENCES formulations(id) ON DELETE SET NULL,
    fill_volume NUMERIC,
    wholesale_price NUMERIC DEFAULT 0,
    retail_price NUMERIC DEFAULT 0,
    wholesale_min_qty NUMERIC DEFAULT 1,
    selling_price NUMERIC DEFAULT 0,
    cost_price NUMERIC DEFAULT 0,
    stock_qty NUMERIC NOT NULL DEFAULT 0,
    low_stock_threshold NUMERIC NOT NULL DEFAULT 0,
    supplier_name TEXT DEFAULT '',
    supplier_number TEXT DEFAULT '',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- ──────────────────────────────────────────────────────────────────────────────
-- 7. PRODUCT FORMULA (product-level recipe, separate from formulations)
-- ──────────────────────────────────────────────────────────────────────────────
CREATE TABLE product_formula (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    raw_material_id UUID NOT NULL REFERENCES raw_materials(id) ON DELETE CASCADE,
    qty_per_batch NUMERIC NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- ──────────────────────────────────────────────────────────────────────────────
-- 8. CUSTOMERS
-- ──────────────────────────────────────────────────────────────────────────────
CREATE TABLE customers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    company_name TEXT DEFAULT '',
    phone TEXT DEFAULT '',
    email TEXT DEFAULT '',
    address TEXT DEFAULT '',
    gst_number TEXT DEFAULT '',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- ──────────────────────────────────────────────────────────────────────────────
-- 9. INVOICES
-- ──────────────────────────────────────────────────────────────────────────────
CREATE TABLE invoices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_number TEXT NOT NULL UNIQUE,
    customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
    status TEXT NOT NULL DEFAULT 'draft',        -- draft, confirmed, partial, paid, cancelled
    invoice_date DATE,
    due_date DATE,
    subtotal NUMERIC DEFAULT 0,
    discount_pct NUMERIC DEFAULT 0,
    gst_pct NUMERIC DEFAULT 0,
    total NUMERIC DEFAULT 0,
    amount_paid NUMERIC DEFAULT 0,
    notes TEXT DEFAULT '',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- ──────────────────────────────────────────────────────────────────────────────
-- 10. INVOICE ITEMS (line items)
-- ──────────────────────────────────────────────────────────────────────────────
CREATE TABLE invoice_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_id UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
    qty NUMERIC NOT NULL,
    unit_price NUMERIC NOT NULL,
    line_total NUMERIC NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- ──────────────────────────────────────────────────────────────────────────────
-- 11. PURCHASE LOG (raw material purchases)
-- ──────────────────────────────────────────────────────────────────────────────
CREATE TABLE purchase_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    raw_material_id UUID NOT NULL REFERENCES raw_materials(id) ON DELETE CASCADE,
    qty NUMERIC NOT NULL,
    price_paid NUMERIC DEFAULT 0,
    supplier TEXT DEFAULT '',
    purchase_date DATE,
    notes TEXT DEFAULT '',
    created_at TIMESTAMPTZ DEFAULT now()
);

-- ──────────────────────────────────────────────────────────────────────────────
-- 12. PRODUCTION LOG (finished goods production)
-- ──────────────────────────────────────────────────────────────────────────────
CREATE TABLE production_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    batches_produced NUMERIC NOT NULL,
    produced_date DATE,
    notes TEXT DEFAULT '',
    created_at TIMESTAMPTZ DEFAULT now()
);

-- ──────────────────────────────────────────────────────────────────────────────
-- INDEXES (for faster lookups on common queries)
-- ──────────────────────────────────────────────────────────────────────────────
CREATE INDEX idx_invoices_customer ON invoices(customer_id);
CREATE INDEX idx_invoices_status ON invoices(status);
CREATE INDEX idx_invoice_items_invoice ON invoice_items(invoice_id);
CREATE INDEX idx_product_formula_product ON product_formula(product_id);
CREATE INDEX idx_formulation_ingredients_formulation ON formulation_ingredients(formulation_id);
CREATE INDEX idx_purchase_log_material ON purchase_log(raw_material_id);
CREATE INDEX idx_production_log_product ON production_log(product_id);
CREATE INDEX idx_products_category ON products(category_id);

-- ──────────────────────────────────────────────────────────────────────────────
-- ROW LEVEL SECURITY (Supabase requires this enabled for API access)
-- ──────────────────────────────────────────────────────────────────────────────
-- Enable RLS on all tables (your backend uses the service_role key which
-- bypasses RLS, so no policies are needed for backend-only access).
ALTER TABLE raw_materials ENABLE ROW LEVEL SECURITY;
ALTER TABLE raw_material_price_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE formulations ENABLE ROW LEVEL SECURITY;
ALTER TABLE formulation_ingredients ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_formula ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE production_log ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- DONE! Now import your CSV backups via Supabase Table Editor → Import CSV.
-- Import order: raw_materials → product_categories → formulations →
--   formulation_ingredients → products → product_formula → customers →
--   invoices → invoice_items → purchase_log → production_log
-- ============================================================================

-- ──────────────────────────────────────────────────────────────────────────────
-- 13. LOOSE PACKING LOG (repacking bulk raw materials into finished goods)
-- ──────────────────────────────────────────────────────────────────────────────
CREATE TABLE loose_packing_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    bulk_product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    yield_product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    bulk_product_qty NUMERIC NOT NULL,
    yield_product_qty NUMERIC NOT NULL,
    packing_date DATE,
    notes TEXT DEFAULT '',
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Optimize lookups
CREATE INDEX idx_loose_packing_log_bulk ON loose_packing_log(bulk_product_id);
CREATE INDEX idx_loose_packing_log_yield ON loose_packing_log(yield_product_id);
ALTER TABLE loose_packing_log ENABLE ROW LEVEL SECURITY;
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
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
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
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
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
