-- Dodatkowe kh_Id dla jednego dostawcy (np. zmiana kontrahenta w Subiekcie).
CREATE TABLE IF NOT EXISTS supplier_subiekt_kh_aliases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id UUID NOT NULL REFERENCES suppliers (id) ON DELETE CASCADE,
  subiekt_kh_id INTEGER NOT NULL,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT supplier_subiekt_kh_aliases_kh_positive CHECK (subiekt_kh_id > 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_supplier_subiekt_kh_aliases_kh
  ON supplier_subiekt_kh_aliases (subiekt_kh_id);

CREATE INDEX IF NOT EXISTS idx_supplier_subiekt_kh_aliases_supplier
  ON supplier_subiekt_kh_aliases (supplier_id);

COMMENT ON TABLE supplier_subiekt_kh_aliases IS
  'Dodatkowe identyfikatory kontrahenta Subiekt (kh_Id) dla jednego dostawcy — np. stary i nowy kontrahent po zmianie firmy.';
