-- Śledzenie zmian terminu realizacji w dopasowanym ZD (Subiekt).

ALTER TABLE individual_orders
  ADD COLUMN IF NOT EXISTS zd_fulfillment_previous_deadline DATE NULL,
  ADD COLUMN IF NOT EXISTS zd_fulfillment_deadline_changed_at TIMESTAMPTZ NULL,
  ADD COLUMN IF NOT EXISTS zd_fulfillment_deadline_change_seen_at TIMESTAMPTZ NULL;

COMMENT ON COLUMN individual_orders.zd_fulfillment_previous_deadline IS
  'Poprzedni termin ZD przed ostatnią zmianą wykrytą podczas synchronizacji.';
COMMENT ON COLUMN individual_orders.zd_fulfillment_deadline_changed_at IS
  'Kiedy sync wykrył zmianę terminu w dokumencie ZD.';
COMMENT ON COLUMN individual_orders.zd_fulfillment_deadline_change_seen_at IS
  'Kiedy handlowiec potwierdził informację o zmianie terminu ZD.';
