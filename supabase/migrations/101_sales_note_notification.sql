ALTER TABLE individual_orders
  ADD COLUMN IF NOT EXISTS sales_request_note_updated_at timestamptz,
  ADD COLUMN IF NOT EXISTS procurement_cancel_note_updated_at timestamptz;

COMMENT ON COLUMN individual_orders.sales_request_note_updated_at IS
  'Kiedy dział zakupów ostatnio zmienił uwagi do prośby — do powiadomień handlowca';
COMMENT ON COLUMN individual_orders.procurement_cancel_note_updated_at IS
  'Kiedy dział zakupów ostatnio zmienił wiadomość przy anuleniu — do powiadomień handlowca';

NOTIFY pgrst, 'reload schema';
