-- Per-line delivered counts for teeth receive (keys = teethReceiveGroupKey).
ALTER TABLE individual_orders
  ADD COLUMN IF NOT EXISTS teeth_line_delivered jsonb;

COMMENT ON COLUMN individual_orders.teeth_line_delivered IS
  'Mapa przyjętych sztuk per linia spec zębów (klucz: color|mould|jaw|kind).';
