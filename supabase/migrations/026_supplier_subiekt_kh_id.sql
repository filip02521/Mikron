-- Powiązanie dostawcy w aplikacji z kontrahentem Subiekt (dopasowanie po kh_Id, nie tylko po nazwie).
ALTER TABLE suppliers
  ADD COLUMN IF NOT EXISTS subiekt_kh_id INTEGER;

CREATE UNIQUE INDEX IF NOT EXISTS idx_suppliers_subiekt_kh_id
  ON suppliers (subiekt_kh_id)
  WHERE subiekt_kh_id IS NOT NULL;

COMMENT ON COLUMN suppliers.subiekt_kh_id IS
  'Id kontrahenta-dostawcy w Subiekcie (kh_Id). Używane przy auto-ustawianiu dostawcy z ZD i podpowiedziach.';
