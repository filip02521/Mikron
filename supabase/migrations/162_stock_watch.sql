-- 162_stock_watch.sql
-- Moduł „Braki i zamówienia” (stock watch): nocna analiza rotacji, ceny zakupu z ZD,
-- szkice zamówień do dostawców.
--
-- Flagi produktów NIE mają nowej tabeli — moduł używa reguł kreatora ZD:
--   zd_estimate_exclusions  → „Wykluczone” (bez alertów i propozycji),
--   zd_estimate_on_request  → „Na prośbę” (bez zapasu; tylko pod klienta),
--   brak wpisu              → „Standard”.
--
-- stock_watch_runs   — przebiegi nocnego workera (kontynuacja w kolejnych slotach crona).
-- stock_watch_items  — ostatni wynik analizy per towar (jeden wiersz na tw_Id).
-- product_purchase_prices — ostatnia cena netto z linii ZD (jednostka dokumentu ZD).
-- purchase_order_drafts / _lines — szkice zamówień (edycja przed utworzeniem ZD w Subiekcie).

CREATE TABLE IF NOT EXISTS public.stock_watch_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Dzień analizy (Europe/Warsaw) — jeden kompletny przebieg na dzień.
  run_date date NOT NULL,
  trigger_kind text NOT NULL DEFAULT 'cron',
  status text NOT NULL DEFAULT 'running',
  started_at timestamptz NOT NULL DEFAULT now(),
  heartbeat_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz NULL,
  sales_end_date date NOT NULL,
  scopes_total integer NOT NULL DEFAULT 0,
  -- supplier_id zakresów już przeliczonych w tym przebiegu (kontynuacja po limicie czasu).
  scopes_done uuid[] NOT NULL DEFAULT '{}',
  scopes_failed jsonb NOT NULL DEFAULT '[]'::jsonb,
  items_written integer NOT NULL DEFAULT 0,
  prices_updated integer NOT NULL DEFAULT 0,
  error text NULL,
  detail jsonb NOT NULL DEFAULT '{}'::jsonb,
  CONSTRAINT stock_watch_runs_trigger_check
    CHECK (trigger_kind IN ('cron', 'manual')),
  CONSTRAINT stock_watch_runs_status_check
    CHECK (status IN ('running', 'ok', 'partial', 'failed')),
  CONSTRAINT stock_watch_runs_error_len
    CHECK (error IS NULL OR char_length(error) <= 2000)
);

CREATE INDEX IF NOT EXISTS stock_watch_runs_run_date_idx
  ON public.stock_watch_runs (run_date DESC, started_at DESC);

CREATE TABLE IF NOT EXISTS public.stock_watch_items (
  subiekt_tw_id integer PRIMARY KEY,
  supplier_id uuid NULL REFERENCES public.suppliers(id) ON DELETE SET NULL,
  run_id uuid NULL REFERENCES public.stock_watch_runs(id) ON DELETE SET NULL,
  tw_symbol text NULL,
  tw_nazwa text NOT NULL DEFAULT '',
  grt_nazwa text NULL,
  scope_mode text NULL,
  scope_id integer NULL,
  -- Stany i ruch (sztuki karty Subiekta).
  stock_qty numeric NOT NULL DEFAULT 0,
  reserved_qty numeric NOT NULL DEFAULT 0,
  available_qty numeric NOT NULL DEFAULT 0,
  open_zd_qty numeric NOT NULL DEFAULT 0,
  open_zk_unreserved_qty numeric NOT NULL DEFAULT 0,
  sales_30d numeric NOT NULL DEFAULT 0,
  sales_60d numeric NOT NULL DEFAULT 0,
  -- Rotacja (szt/dzień, ważona 30/60 dni) i trend (v30 / v60).
  velocity_daily numeric NOT NULL DEFAULT 0,
  velocity_trend numeric NULL,
  -- Ile dni starczy stanu dostępnego (NULL = brak sprzedaży).
  days_of_cover numeric NULL,
  run_out_date date NULL,
  -- Bufor = rotacja × dni zapasu dostawcy (+ minimum stanów).
  buffer_days integer NOT NULL DEFAULT 30,
  safety_stock_qty numeric NOT NULL DEFAULT 0,
  min_stock_qty numeric NULL,
  suggested_qty numeric NOT NULL DEFAULT 0,
  unit_price_net numeric NULL,
  daily_value numeric NULL,
  status text NOT NULL DEFAULT 'ok',
  computed_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT stock_watch_items_status_check
    CHECK (status IN ('out_of_stock', 'critical', 'warning', 'ok', 'no_sales')),
  CONSTRAINT stock_watch_items_scope_mode_check
    CHECK (scope_mode IS NULL OR scope_mode IN ('grupa', 'cecha'))
);

CREATE INDEX IF NOT EXISTS stock_watch_items_supplier_idx
  ON public.stock_watch_items (supplier_id);
CREATE INDEX IF NOT EXISTS stock_watch_items_status_idx
  ON public.stock_watch_items (status, days_of_cover);
CREATE INDEX IF NOT EXISTS stock_watch_items_velocity_idx
  ON public.stock_watch_items (velocity_daily DESC);

CREATE TABLE IF NOT EXISTS public.product_purchase_prices (
  subiekt_tw_id integer PRIMARY KEY,
  -- Cena netto z linii ZD — za jednostkę dokumentu (przy opakowaniach: za paczkę).
  price_net numeric NOT NULL,
  dok_id integer NOT NULL,
  dok_nr text NULL,
  dok_date date NULL,
  kh_id integer NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT product_purchase_prices_price_positive CHECK (price_net > 0)
);

-- Które ZD z lokalnego indeksu (sync katalogu) już dały ceny — worker bierze kolejne porcje.
ALTER TABLE public.subiekt_zd_index
  ADD COLUMN IF NOT EXISTS price_harvested_at timestamptz NULL;

CREATE INDEX IF NOT EXISTS subiekt_zd_index_price_pending_idx
  ON public.subiekt_zd_index (dok_data_wyst DESC)
  WHERE price_harvested_at IS NULL;

CREATE TABLE IF NOT EXISTS public.purchase_order_drafts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id uuid NOT NULL REFERENCES public.suppliers(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'draft',
  note text NOT NULL DEFAULT '',
  source_run_id uuid NULL REFERENCES public.stock_watch_runs(id) ON DELETE SET NULL,
  zd_dok_id integer NULL,
  zd_dok_nr text NULL,
  submitted_at timestamptz NULL,
  submitted_by uuid NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_by uuid NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT purchase_order_drafts_status_check
    CHECK (status IN ('draft', 'submitted', 'cancelled')),
  CONSTRAINT purchase_order_drafts_note_len
    CHECK (char_length(note) <= 1000)
);

-- Najwyżej jeden otwarty szkic na dostawcę — „Przygotuj zamówienie” wraca do istniejącego.
CREATE UNIQUE INDEX IF NOT EXISTS purchase_order_drafts_one_open_per_supplier
  ON public.purchase_order_drafts (supplier_id)
  WHERE status = 'draft';

CREATE INDEX IF NOT EXISTS purchase_order_drafts_status_idx
  ON public.purchase_order_drafts (status, updated_at DESC);

CREATE TABLE IF NOT EXISTS public.purchase_order_draft_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  draft_id uuid NOT NULL REFERENCES public.purchase_order_drafts(id) ON DELETE CASCADE,
  subiekt_tw_id integer NOT NULL,
  tw_symbol text NULL,
  tw_nazwa text NOT NULL DEFAULT '',
  -- Ilość w sztukach karty (przeliczenie na jednostki ZD przy tworzeniu dokumentu).
  qty numeric NOT NULL,
  suggested_qty numeric NOT NULL DEFAULT 0,
  unit_price_net numeric NULL,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT purchase_order_draft_lines_qty_positive CHECK (qty > 0),
  CONSTRAINT purchase_order_draft_lines_unique_tw UNIQUE (draft_id, subiekt_tw_id)
);

CREATE INDEX IF NOT EXISTS purchase_order_draft_lines_draft_idx
  ON public.purchase_order_draft_lines (draft_id, sort_order);

ALTER TABLE public.stock_watch_runs DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_watch_items DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_purchase_prices DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_order_drafts DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_order_draft_lines DISABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'ontime_app') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON
      public.stock_watch_runs,
      public.stock_watch_items,
      public.product_purchase_prices,
      public.purchase_order_drafts,
      public.purchase_order_draft_lines
    TO ontime_app;
  END IF;
END
$$;
