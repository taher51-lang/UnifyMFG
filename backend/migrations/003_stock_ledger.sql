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
