-- Magazyn rozliczył rezygnację (przyjęcie na stan / zwrot / zdjęcie z regału)
ALTER TABLE individual_orders
  ADD COLUMN IF NOT EXISTS warehouse_cancel_fulfilled_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_individual_orders_warehouse_cancel_fulfilled
  ON individual_orders (warehouse_cancel_fulfilled_at)
  WHERE sales_cancelled_at IS NOT NULL
    AND procurement_cancel_disposition IS NOT NULL
    AND warehouse_cancel_fulfilled_at IS NULL;

COMMENT ON COLUMN individual_orders.warehouse_cancel_fulfilled_at IS
  'Magazyn potwierdził rozliczenie rezygnacji (stan / zwrot / zdjęcie z regału) — pozycja znika z kolejki przyjęcia.';
