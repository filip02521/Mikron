-- Zęby: śledzenie zamówienia per pozycja (individual tooth detail).
-- Pozwala zamawiać poszczególne zęby u dostawcy niezależnie.
-- Gdy wszystkie pozycje zamówienia mają ordered_at ≠ null,
-- individual_orders.status automatycznie przechodzi w "Zamowione".

ALTER TABLE individual_order_teeth_details
  ADD COLUMN IF NOT EXISTS ordered_at TIMESTAMPTZ NULL;

COMMENT ON COLUMN individual_order_teeth_details.ordered_at IS
  'Kiedy ten konkretny ząb został zamówiony u dostawcy. Null = jeszcze nie zamówiony.';

-- Indeks do szybkiego filtrowania niezamówionych pozycji.
CREATE INDEX IF NOT EXISTS individual_order_teeth_details_ordered_at_idx
  ON individual_order_teeth_details (order_id)
  WHERE ordered_at IS NULL;
