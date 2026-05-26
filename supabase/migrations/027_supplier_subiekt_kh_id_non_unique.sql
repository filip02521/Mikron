-- Kilka kart dostawcy w app (np. Ernst Hinrichs gipsy / materiały) może wskazywać ten sam kontrahent Subiekt.
DROP INDEX IF EXISTS idx_suppliers_subiekt_kh_id;

CREATE INDEX IF NOT EXISTS idx_suppliers_subiekt_kh_id
  ON suppliers (subiekt_kh_id)
  WHERE subiekt_kh_id IS NOT NULL;
