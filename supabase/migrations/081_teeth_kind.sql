-- Pole przednie/tylne (typ zęba) per pozycja zamówienia zębowego.
-- Niezależne od szczęki (jaw) — górna/dolna szczęka ma i przednie, i tylne zęby.
ALTER TABLE individual_order_teeth_details
  ADD COLUMN IF NOT EXISTS kind TEXT NULL;
-- Wartości: 'anterior' | 'posterior' | null

COMMENT ON COLUMN individual_order_teeth_details.kind IS
  'Typ zęba: anterior (przednie) lub posterior (tylne). Null = nie podano. Niezależne od jaw (szczęka).';
