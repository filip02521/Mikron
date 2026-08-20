-- Kiedy prośba zębowa trafiła do kolejki działu zębów (po OCR lub od razu).

ALTER TABLE individual_orders
  ADD COLUMN IF NOT EXISTS teeth_queue_entered_at TIMESTAMPTZ NULL;

COMMENT ON COLUMN individual_orders.teeth_queue_entered_at IS
  'Moment wejścia prośby zębowej do kolejki działu zębów (po zatwierdzeniu OCR lub przy zgłoszeniu bez OCR).';

-- Istniejące pozycje w kolejce — przybliżenie z created_at (bez OCR pending).
UPDATE individual_orders
SET teeth_queue_entered_at = created_at
WHERE is_teeth = true
  AND teeth_queue_entered_at IS NULL
  AND COALESCE(teeth_ocr_pending, false) = false
  AND status IN ('Nowe', 'Weryfikacja');

CREATE INDEX IF NOT EXISTS idx_individual_orders_teeth_queue_entered
  ON individual_orders (teeth_queue_entered_at)
  WHERE is_teeth = true AND teeth_queue_entered_at IS NOT NULL;
