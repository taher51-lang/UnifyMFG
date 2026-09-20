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
