-- Czas realizacji liczony od zamówienia u dostawcy, nie od zgłoszenia prośby przez handlowca
ALTER TABLE individual_orders
  ADD COLUMN IF NOT EXISTS ordered_at TIMESTAMPTZ;

-- Istniejące pozycje już zamówione: przybliżenie (brak osobnej daty w starych danych)
UPDATE individual_orders
SET ordered_at = action_at
WHERE ordered_at IS NULL
  AND status IN ('Zamowione', 'Czesciowo_zrealizowane', 'Zrealizowane')
  AND COALESCE(request_kind::text, 'zamowienie') = 'zamowienie';

CREATE INDEX IF NOT EXISTS idx_individual_orders_ordered_at
  ON individual_orders (ordered_at)
  WHERE ordered_at IS NOT NULL;

NOTIFY pgrst, 'reload schema';
