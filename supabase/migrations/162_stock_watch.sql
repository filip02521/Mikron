-- 162_stock_watch.sql
-- Moduł „Braki i zamówienia” (stock watch): nocny przebieg silnika zamówień ZD
-- (ten sam co Kreator ZD) + ceny zakupu z ZD. Panel tylko pokazuje i prowadzi do Kreatora —
-- ZD powstaje wyłącznie w Kreatorze.
--
-- Flagi produktów NIE mają nowej tabeli — moduł używa reguł kreatora ZD:
--   zd_estimate_exclusions  → „Wykluczone” (bez alertów i propozycji),
--   zd_estimate_on_request  → „Na prośbę” (bez zapasu; tylko pod klienta),
--   brak wpisu              → „Standard”.
--
-- stock_watch_runs   — przebiegi nocnego workera (kontynuacja w kolejnych slotach crona).
-- stock_watch_items  — ostatni wynik per (dostawca, towar): stany, rotacja, „Do ZD” z silnika.
-- stock_watch_supplier_orders — podsumowanie listy „Do ZD” per dostawca (jak nagłówek Kreatora).
-- product_purchase_prices — ostatnia cena netto z linii ZD (jednostka dokumentu ZD).

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
  supplier_id uuid NOT NULL REFERENCES public.suppliers(id) ON DELETE CASCADE,
  subiekt_tw_id integer NOT NULL,
  run_id uuid NULL REFERENCES public.stock_watch_runs(id) ON DELETE SET NULL,
  tw_symbol text NULL,
  tw_nazwa text NOT NULL DEFAULT '',
  grt_nazwa text NULL,
  scope_mode text NULL,
  scope_id integer NULL,
  -- Stany i ruch (sztuki karty Subiekta), jak w Kreatorze ZD.
  stock_qty numeric NOT NULL DEFAULT 0,
  reserved_qty numeric NOT NULL DEFAULT 0,
  available_qty numeric NOT NULL DEFAULT 0,
  -- Otwarte ZD przeliczone na sztuki.
  open_zd_qty numeric NOT NULL DEFAULT 0,
  open_zk_unreserved_qty numeric NOT NULL DEFAULT 0,
  -- Sprzedaż w oknie Kreatora (dni zapasu dostawcy, koniec = ostatnia FS).
  sales_period_qty numeric NOT NULL DEFAULT 0,
  sales_period_days integer NOT NULL DEFAULT 30,
  velocity_daily numeric NOT NULL DEFAULT 0,
  -- Rezerwa na trend (etap 3) — na razie NULL.
  velocity_trend numeric NULL,
  -- Ile dni starczy stanu dostępnego (NULL = brak sprzedaży).
  days_of_cover numeric NULL,
  run_out_date date NULL,
  buffer_days integer NOT NULL DEFAULT 30,
  -- Cel zapasu z Kreatora (po korekcie boost/cięcia, min. stanów).
  target_qty numeric NOT NULL DEFAULT 0,
  min_stock_qty numeric NULL,
  -- „Do ZD” z silnika: pozycja na liście Kreatora, ilość na dokumencie i w sztukach.
  in_order boolean NOT NULL DEFAULT false,
  order_zd_units numeric NOT NULL DEFAULT 0,
  order_unit_label text NULL,
  order_pieces numeric NOT NULL DEFAULT 0,
  order_individual_pieces numeric NOT NULL DEFAULT 0,
  order_value numeric NULL,
  unit_price_net numeric NULL,
  daily_value numeric NULL,
  -- Sygnał z czasu dostawy (bez wpływu na ilość): skończy się przed dostawą
  -- zamówienia złożonego dziś / przed dostawą z kolejnego planowego zamówienia.
  delivery_risk text NULL,
  status text NOT NULL DEFAULT 'ok',
  computed_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (supplier_id, subiekt_tw_id),
  CONSTRAINT stock_watch_items_status_check
    CHECK (status IN ('out_of_stock', 'critical', 'warning', 'ok', 'no_sales')),
  CONSTRAINT stock_watch_items_scope_mode_check
    CHECK (scope_mode IS NULL OR scope_mode IN ('grupa', 'cecha')),
  CONSTRAINT stock_watch_items_delivery_risk_check
    CHECK (delivery_risk IS NULL OR delivery_risk IN ('before_delivery', 'before_next_delivery'))
);

CREATE INDEX IF NOT EXISTS stock_watch_items_tw_idx
  ON public.stock_watch_items (subiekt_tw_id);
CREATE INDEX IF NOT EXISTS stock_watch_items_status_idx
  ON public.stock_watch_items (status, days_of_cover);
CREATE INDEX IF NOT EXISTS stock_watch_items_velocity_idx
  ON public.stock_watch_items (velocity_daily DESC);

CREATE TABLE IF NOT EXISTS public.stock_watch_supplier_orders (
  supplier_id uuid PRIMARY KEY REFERENCES public.suppliers(id) ON DELETE CASCADE,
  run_id uuid NULL REFERENCES public.stock_watch_runs(id) ON DELETE SET NULL,
  scope_mode text NOT NULL,
  scope_id integer NOT NULL,
  dni_zapasu integer NOT NULL,
  data_od date NOT NULL,
  data_do date NOT NULL,
  -- Liczba pozycji i suma jednostek ZD — to samo co „Do ZD” w Kreatorze.
  line_count integer NOT NULL DEFAULT 0,
  zd_units_sum numeric NOT NULL DEFAULT 0,
  order_value numeric NOT NULL DEFAULT 0,
  unpriced_count integer NOT NULL DEFAULT 0,
  -- Kreator pokazałby pustą listę / zablokował Utwórz ZD.
  explode_bom_incomplete boolean NOT NULL DEFAULT false,
  history_fetch_failed boolean NOT NULL DEFAULT false,
  pending_individuals_error text NULL,
  truncated boolean NOT NULL DEFAULT false,
  -- Czas dostawy (dni kalendarzowe) i kolejne planowe zamówienie — do sygnałów.
  lead_days integer NULL,
  lead_source text NULL,
  lead_samples integer NULL,
  next_order_date date NULL,
  next_order_days integer NULL,
  computed_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT stock_watch_supplier_orders_scope_mode_check
    CHECK (scope_mode IN ('grupa', 'cecha'))
);

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

ALTER TABLE public.stock_watch_runs DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_watch_items DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_purchase_prices DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_watch_supplier_orders DISABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'ontime_app') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON
      public.stock_watch_runs,
      public.stock_watch_items,
      public.product_purchase_prices,
      public.stock_watch_supplier_orders
    TO ontime_app;
  END IF;
END
$$;
