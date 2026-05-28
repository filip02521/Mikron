-- Indeks ZD Subiekta → dostawca w aplikacji.
-- Cel: raz przejść po dokumentach ZD i przypisać je do supplier_id (po subiekt_kh_id),
-- żeby późniejsze importy produktów działały per-dostawca bez kosztownych zapytań i bez błędów.

CREATE TABLE IF NOT EXISTS subiekt_zd_index (
  dok_id INTEGER PRIMARY KEY,
  dok_nr_pelny TEXT NULL,
  dok_data_wyst TEXT NULL,
  subiekt_kh_id INTEGER NULL,
  supplier_id UUID NULL REFERENCES suppliers(id) ON DELETE SET NULL,
  verified BOOLEAN NOT NULL DEFAULT false,
  processed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  note TEXT NOT NULL DEFAULT ''
);

CREATE INDEX IF NOT EXISTS idx_subiekt_zd_index_supplier
  ON subiekt_zd_index (supplier_id);

CREATE INDEX IF NOT EXISTS idx_subiekt_zd_index_kh
  ON subiekt_zd_index (subiekt_kh_id);

CREATE INDEX IF NOT EXISTS idx_subiekt_zd_index_processed_at
  ON subiekt_zd_index (processed_at DESC);

ALTER TABLE subiekt_zd_index ENABLE ROW LEVEL SECURITY;

CREATE POLICY subiekt_zd_index_admin ON subiekt_zd_index
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

