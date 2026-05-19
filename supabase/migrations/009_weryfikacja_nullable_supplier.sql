ALTER TABLE individual_orders
  ALTER COLUMN supplier_id DROP NOT NULL;

CREATE INDEX IF NOT EXISTS idx_individual_orders_weryfikacja
  ON individual_orders (status)
  WHERE status = 'Weryfikacja';

NOTIFY pgrst, 'reload schema';
