ALTER TABLE subiekt_zd_index
  ADD COLUMN IF NOT EXISTS subiekt_kh_label TEXT;

COMMENT ON COLUMN subiekt_zd_index.subiekt_kh_label IS
  'Nazwa kontrahenta z dokumentu ZD (embed) w momencie indeksowania — do list diagnostycznych.';
