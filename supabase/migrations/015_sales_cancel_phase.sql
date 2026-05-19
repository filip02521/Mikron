-- Faza rezygnacji handlowca (wpływa na panel dzienny vs realizacja)
ALTER TABLE individual_orders
  ADD COLUMN IF NOT EXISTS sales_cancel_phase TEXT;

COMMENT ON COLUMN individual_orders.sales_cancel_phase IS
  'before_order | in_transit | on_stock — ustawiane przy sales_cancelled_at';
