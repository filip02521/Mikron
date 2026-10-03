-- 168_subiekt_lead_times.sql
-- Czasy dostaw liczone z Subiekta: ZD (wysłane) → FZ (przyjęte).
-- 1) Kopia nagłówków ZD/FZ (historia od 2006) — analiza bez ponownego pobierania.
-- 2) Próbki delivery_stats_samples ze źródłem 'subiekt' (1 wiersz = 1 zamówienie / łańcuch braków).

CREATE TABLE IF NOT EXISTS public.subiekt_purchase_docs (
  dok_id integer PRIMARY KEY,
  typ smallint NOT NULL CHECK (typ IN (1, 15)), -- 1 = FZ, 15 = ZD
  nr_pelny text,
  nr_oryg text,
  kh_id integer,
  kh_symbol text,
  data_wyst date,
  data_mag date,
  status smallint,
  do_dok_id integer,
  uwagi text,
  wart_netto numeric(14, 2),
  synced_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS subiekt_purchase_docs_typ_kh_idx
  ON public.subiekt_purchase_docs (typ, kh_id);
CREATE INDEX IF NOT EXISTS subiekt_purchase_docs_do_dok_idx
  ON public.subiekt_purchase_docs (do_dok_id)
  WHERE do_dok_id IS NOT NULL;

COMMENT ON TABLE public.subiekt_purchase_docs IS
  'Nagłówki ZD (typ 15) i FZ (typ 1) z Subiekta — źródło czasów dostaw ZD → FZ.';

ALTER TABLE public.delivery_stats_samples
  DROP CONSTRAINT IF EXISTS delivery_stats_samples_source_check;
ALTER TABLE public.delivery_stats_samples
  ADD CONSTRAINT delivery_stats_samples_source_check
  CHECK (source IN ('receive', 'backfill', 'import', 'subiekt'));

ALTER TABLE public.delivery_stats_samples
  ADD COLUMN IF NOT EXISTS subiekt_zd_id integer,
  ADD COLUMN IF NOT EXISTS subiekt_fz_id integer,
  ADD COLUMN IF NOT EXISTS date_corrected boolean NOT NULL DEFAULT false;

CREATE UNIQUE INDEX IF NOT EXISTS delivery_stats_samples_subiekt_zd_uidx
  ON public.delivery_stats_samples (subiekt_zd_id)
  WHERE deleted_at IS NULL AND subiekt_zd_id IS NOT NULL;
