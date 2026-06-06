ALTER TABLE individual_orders
  ADD COLUMN IF NOT EXISTS source_zk_watch_id UUID REFERENCES sales_zk_watches (id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS source_zk_number TEXT;

CREATE INDEX IF NOT EXISTS idx_individual_orders_source_zk_watch_id
  ON individual_orders (source_zk_watch_id)
  WHERE source_zk_watch_id IS NOT NULL;

COMMENT ON COLUMN individual_orders.source_zk_watch_id IS
  'Karta ZK z notatnika, z której utworzono prośbę (przycisk Prośba).';
COMMENT ON COLUMN individual_orders.source_zk_number IS
  'Numer ZK w momencie złożenia prośby — do wyszukiwania i podpowiedzi w notatniku.';
