-- Fizyczne miejsce na magazynie (regał / strefa) — inwentaryzacja w zakładce Magazyn i regał
ALTER TABLE individual_orders
  ADD COLUMN IF NOT EXISTS warehouse_shelf TEXT;

COMMENT ON COLUMN individual_orders.warehouse_shelf IS
  'Lokalizacja na magazynie (np. Regał B3) — do inwentaryzacji i odbioru przez handlowca';
