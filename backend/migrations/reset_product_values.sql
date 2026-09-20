-- ============================================================================
-- SCRIPT: Reset Product Costs, Prices, Stock & Formulation Links
-- ============================================================================
-- Keeps:
--   - id
--   - name (Product Name)
--   - category_id (Category)
--   - packaging & suppliers
--
-- Resets:
--   - cost_price        -> 0
--   - wholesale_price   -> 0
--   - retail_price      -> 0
--   - selling_price     -> 0
--   - stock_qty         -> 0
--   - formulation_id    -> NULL
--   - fill_volume       -> NULL
-- ============================================================================

UPDATE products
SET
    cost_price = 0,
    wholesale_price = 0,
    retail_price = 0,
    selling_price = 0,
    stock_qty = 0,
    formulation_id = NULL,
    fill_volume = NULL;

-- ────────────────────────────────────────────────────────────────────────────
-- Optional: If you also want to reset cost_price in the formulations table:
-- UPDATE formulations SET cost_price = 0;
-- ────────────────────────────────────────────────────────────────────────────
