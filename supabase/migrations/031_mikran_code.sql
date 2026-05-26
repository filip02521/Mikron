-- Kod Mikran (tw_PLU z Subiekta) — opcjonalnie przy prośbie handlowca
ALTER TABLE individual_orders
  ADD COLUMN IF NOT EXISTS mikran_code TEXT;

COMMENT ON COLUMN individual_orders.mikran_code IS
  'Kod Mikran (tw_PLU) — wpis ręczny lub z kartoteki Subiekt.';
