-- Śledzenie, które pozycje ZK (towar) już dotarły — notatnik „Czeka na towar”.

ALTER TABLE sales_zk_watches
  ADD COLUMN IF NOT EXISTS line_checks JSONB NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN sales_zk_watches.line_checks IS
  'Checkboxy odbioru pozycji: [{ "key": "ob:123", "arrived": true }, ...]. Klucze z pozycji Subiekta (ob_Id / tw_Id).';
