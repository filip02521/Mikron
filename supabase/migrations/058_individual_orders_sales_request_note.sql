-- Opcjonalna notatka handlowca do prośby — widoczna w panelu dziennym zakupów.
ALTER TABLE individual_orders
  ADD COLUMN IF NOT EXISTS sales_request_note TEXT;

COMMENT ON COLUMN individual_orders.sales_request_note IS
  'Uwagi handlowca do prośby — widoczne w panelu dziennym (Dziś) przy pozycji / grupie.';

NOTIFY pgrst, 'reload schema';
