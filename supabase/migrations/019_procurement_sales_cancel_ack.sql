-- Zakupy potwierdziły zapoznanie z rezygnacją / wycofaniem zamówienia dla klienta (panel dzienny).
ALTER TABLE individual_orders
  ADD COLUMN IF NOT EXISTS procurement_sales_cancel_ack_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_individual_orders_procurement_sales_cancel_ack
  ON individual_orders (procurement_sales_cancel_ack_at)
  WHERE sales_cancelled_at IS NOT NULL AND procurement_sales_cancel_ack_at IS NULL;
