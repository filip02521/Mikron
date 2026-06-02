-- Zakupy: moment zapoznania z prośbą w panelu dziennym (badge „Nowa”).
ALTER TABLE individual_orders
  ADD COLUMN IF NOT EXISTS procurement_seen_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_individual_orders_procurement_seen
  ON individual_orders (procurement_seen_at)
  WHERE status = 'Nowe' AND procurement_seen_at IS NULL;
