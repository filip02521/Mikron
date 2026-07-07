ALTER TABLE individual_orders
  ADD COLUMN IF NOT EXISTS teeth_ocr_image_path TEXT;

COMMENT ON COLUMN individual_orders.teeth_ocr_image_path IS
  'Ścieżka do zdjęcia kartki w Supabase Storage (bucket teeth-ocr-images) — używane gdy teeth_ocr_pending=true do weryfikacji przez dział zębów.';
