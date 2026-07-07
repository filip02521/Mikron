ALTER TABLE individual_orders
  ADD COLUMN IF NOT EXISTS teeth_ocr_pending BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN individual_orders.teeth_ocr_pending IS
  'Czy lista zębów została wczytana ze zdjęcia (OCR) i oczekuje weryfikacji przez osobę zębową. Gdy true — order widoczny w /zeby/weryfikacja, ukryty z /zeby/kolejka.';

CREATE INDEX IF NOT EXISTS individual_orders_teeth_ocr_pending_idx
  ON individual_orders (teeth_ocr_pending)
  WHERE teeth_ocr_pending = true;
