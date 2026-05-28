-- Śledzenie importu linii ZD do katalogu (nocny cron / import ręczny).

ALTER TABLE subiekt_zd_index
  ADD COLUMN IF NOT EXISTS catalog_imported_at TIMESTAMPTZ NULL;

CREATE INDEX IF NOT EXISTS idx_subiekt_zd_index_catalog_pending
  ON subiekt_zd_index (dok_data_wyst DESC, dok_id DESC)
  WHERE catalog_imported_at IS NULL
    AND supplier_id IS NOT NULL
    AND verified = true;
