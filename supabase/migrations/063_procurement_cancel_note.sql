ALTER TABLE individual_orders ADD COLUMN IF NOT EXISTS procurement_cancel_note TEXT;

COMMENT ON COLUMN individual_orders.procurement_cancel_note IS
  'Opcjonalna wiadomość od działu dostaw przy anulowaniu prośby — widoczna u handlowca w Moje zamówienia.';

NOTIFY pgrst, 'reload schema';
