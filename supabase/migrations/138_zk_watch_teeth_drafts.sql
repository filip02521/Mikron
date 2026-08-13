-- Szkice list zębów na ZK — uzupełniane przed utworzeniem prośby.
ALTER TABLE sales_zk_watches
  ADD COLUMN IF NOT EXISTS teeth_drafts jsonb NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN sales_zk_watches.teeth_drafts IS
  'Mapa lineKey → szkic listy zębów (TeethLineDetail + meta) przed złożeniem prośby; keyed jak line_checks.';
