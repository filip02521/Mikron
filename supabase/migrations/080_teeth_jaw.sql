-- Pole góra/dół (szczęka) per pozycja zamówienia zębowego.
ALTER TABLE individual_order_teeth_details
  ADD COLUMN IF NOT EXISTS jaw TEXT NULL;
-- Wartości: 'upper' | 'lower' | null

COMMENT ON COLUMN individual_order_teeth_details.jaw IS
  'Szczęka: upper (górna) lub lower (dolna). Null = nie podano.';
