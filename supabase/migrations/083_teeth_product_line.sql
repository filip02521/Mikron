-- Linia produktowa zębów (np. wiedent_estetic, ivoclar_phonares_ii) — dokładniejsze katalogi kolorów i fasonów.
ALTER TABLE prosba_teeth_products
  ADD COLUMN IF NOT EXISTS product_line TEXT NULL;

COMMENT ON COLUMN prosba_teeth_products.product_line IS
  'Linia produktowa zębów: wiedent_classic, ivoclar_phonares_ii, major_super_lux itd.';
