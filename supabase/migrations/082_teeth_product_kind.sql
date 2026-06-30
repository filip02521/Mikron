-- Pole kind (przednie/tylne) w prosba_teeth_products — auto-wykrywane z nazwy produktu.
ALTER TABLE prosba_teeth_products
  ADD COLUMN IF NOT EXISTS kind TEXT NULL;
-- Wartości: 'anterior' | 'posterior' | null

COMMENT ON COLUMN prosba_teeth_products.kind IS
  'Typ zęba: anterior (przednie) lub posterior (tylne/boczne). Auto-wykrywane z nazwy produktu, możliwe do nadpisania w adminie.';
