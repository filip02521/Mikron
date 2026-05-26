-- Powiązanie pozycji z kartoteką towaru Subiekt (tw_Id)
ALTER TABLE individual_orders
  ADD COLUMN IF NOT EXISTS subiekt_tw_id INTEGER;

COMMENT ON COLUMN individual_orders.subiekt_tw_id IS
  'ID towaru w Subiekcie (tw_Id) — ustawiane przy wyborze z kartoteki; NULL = wpis ręczny';
