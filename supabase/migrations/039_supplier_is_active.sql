-- Dostawca nieaktywny: poza panelem dziennym, widoczny w kartach (osobna lista) i terminach z oznaczeniem.
ALTER TABLE suppliers
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true;

CREATE INDEX IF NOT EXISTS idx_suppliers_is_active ON suppliers (is_active)
  WHERE is_active = true;

COMMENT ON COLUMN suppliers.is_active IS 'false = ukryty w panelu dziennym i planie; edycja w Kartach / liście Nieaktywni';
