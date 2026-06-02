ALTER TABLE individual_orders
  ADD COLUMN IF NOT EXISTS sales_client_kh_id INTEGER;

CREATE INDEX IF NOT EXISTS idx_individual_orders_sales_client_kh_id
  ON individual_orders (sales_client_kh_id)
  WHERE sales_client_kh_id IS NOT NULL;

COMMENT ON COLUMN individual_orders.sales_client_kh_id IS
  'kh_Id kontrahenta z Subiekta (odbiorca) — opcjonalnie przy prośbie handlowca; używane do powiązania z ZK czekającym na towar.';
