-- Handlowiec ukrywa pozycję po potwierdzeniu anulowania lub odbioru z magazynu
ALTER TABLE individual_orders
  ADD COLUMN IF NOT EXISTS sales_acknowledged_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_individual_orders_sales_ack
  ON individual_orders (sales_person_id, sales_acknowledged_at)
  WHERE sales_acknowledged_at IS NULL;

NOTIFY pgrst, 'reload schema';
