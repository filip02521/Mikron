-- Rozliczenie rezygnacji handlowca przez dział dostaw (magazyn i regał)
ALTER TABLE individual_orders
  ADD COLUMN IF NOT EXISTS procurement_cancel_disposition TEXT;

ALTER TABLE individual_orders
  ADD COLUMN IF NOT EXISTS procurement_cancel_disposition_note TEXT;

ALTER TABLE individual_orders
  ADD COLUMN IF NOT EXISTS procurement_cancel_disposition_at TIMESTAMPTZ;

COMMENT ON COLUMN individual_orders.procurement_cancel_disposition IS
  'to_stock | return — decyzja magazynu po rezygnacji (in_transit / on_stock)';
