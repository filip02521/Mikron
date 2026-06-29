-- Store dok_Status and realization deadline from Subiekt ZD documents
-- so the "Plan dostaw" page can show all upcoming deliveries (not just
-- those matched to individual_orders via zd_eta_sync).

ALTER TABLE subiekt_zd_index
  ADD COLUMN IF NOT EXISTS dok_status INTEGER NULL;

ALTER TABLE subiekt_zd_index
  ADD COLUMN IF NOT EXISTS dok_termin_realizacji DATE NULL;

COMMENT ON COLUMN subiekt_zd_index.dok_status IS
  'Status dokumentu ZD z Subiekta (5/6/7 = niezrealizowane, 8 = zrealizowane).';

COMMENT ON COLUMN subiekt_zd_index.dok_termin_realizacji IS
  'Termin realizacji ZD (dok_TerminRealizacji / dok_DataRealizacji / dok_Termin) w formacie YYYY-MM-DD.';

CREATE INDEX IF NOT EXISTS idx_subiekt_zd_index_termin_realizacji
  ON subiekt_zd_index (dok_termin_realizacji)
  WHERE dok_termin_realizacji IS NOT NULL
    AND dok_status IS NOT NULL
    AND dok_status IN (5, 6, 7);
