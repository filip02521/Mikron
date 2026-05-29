ALTER TABLE supplier_subiekt_kh_aliases
  ADD COLUMN IF NOT EXISTS subiekt_label TEXT;

COMMENT ON COLUMN supplier_subiekt_kh_aliases.subiekt_label IS
  'Etykieta kontrahenta z Subiekta w momencie dodawania (nazwa / symbol).';
