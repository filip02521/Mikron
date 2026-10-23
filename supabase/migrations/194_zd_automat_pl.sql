-- 194_zd_automat_pl.sql
-- Automat ZD — polscy dostawcy (Faza I, docs/integrations/strategia-zakupowa-pl-automatyzacja.md).
-- Jeden plik dla zadań 2, 4, 5, 7 (TASKS.md): schemat ustalony przed pracą równoległą.

-- 2. Kraj dostawcy z Subiekta (adr_IdPanstwo / adr_Panstwo; 1 = Polska) i próg darmowej dostawy.
ALTER TABLE public.suppliers
  ADD COLUMN IF NOT EXISTS subiekt_country_id integer NULL,
  ADD COLUMN IF NOT EXISTS subiekt_country_name text NULL,
  ADD COLUMN IF NOT EXISTS subiekt_country_synced_at timestamptz NULL,
  ADD COLUMN IF NOT EXISTS free_shipping_threshold numeric(12, 2) NULL;

-- 2. Stopień autonomii (0 = jak dziś … 4 = auto-mail) i godzina odcięcia dla handlowców (dzień przed wysyłką).
ALTER TABLE public.zd_supplier_order_policy
  ADD COLUMN IF NOT EXISTS auto_level smallint NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS cutoff_time time NOT NULL DEFAULT '14:00';
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'zd_supplier_order_policy_auto_level_check') THEN
    ALTER TABLE public.zd_supplier_order_policy
      ADD CONSTRAINT zd_supplier_order_policy_auto_level_check CHECK (auto_level BETWEEN 0 AND 4);
  END IF;
END
$$;

-- 5. Propozycja odłożona (minimum / próg darmowej dostawy nieosiągnięty, bez pilnych linii).
-- 4. Flagi całej propozycji (np. order_value_jump); flagi linii są w lines[].flags.
ALTER TABLE public.zd_auto_proposals
  ADD COLUMN IF NOT EXISTS deferred_reason text NULL,
  ADD COLUMN IF NOT EXISTS flags jsonb NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE public.zd_auto_proposals DROP CONSTRAINT IF EXISTS zd_auto_proposals_status_check;
ALTER TABLE public.zd_auto_proposals
  ADD CONSTRAINT zd_auto_proposals_status_check
  CHECK (status IN ('pending', 'accepted', 'rejected', 'expired', 'deferred'));

-- 7. Klasy ABC (zysk 12 mies.) × XYZ (CV 52 tygodni) per towar zmapowanego zakresu.
CREATE TABLE IF NOT EXISTS public.zd_sku_class (
  subiekt_tw_id integer PRIMARY KEY,
  supplier_id uuid NULL REFERENCES public.suppliers(id) ON DELETE SET NULL,
  abc char(1) NOT NULL CHECK (abc IN ('A', 'B', 'C')),
  xyz char(1) NOT NULL CHECK (xyz IN ('X', 'Y', 'Z', 'N')),
  profit_12m numeric NOT NULL DEFAULT 0,
  revenue_12m numeric NOT NULL DEFAULT 0,
  weekly_cv numeric NULL,
  active_weeks integer NOT NULL DEFAULT 0,
  first_sale_date date NULL,
  override_abc char(1) NULL CHECK (override_abc IS NULL OR override_abc IN ('A', 'B', 'C')),
  override_xyz char(1) NULL CHECK (override_xyz IS NULL OR override_xyz IN ('X', 'Y', 'Z', 'N')),
  override_note text NULL,
  computed_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS zd_sku_class_supplier_idx ON public.zd_sku_class (supplier_id);

-- 7. KPI tygodniowe per dostawca (braki A, rotacja, martwy zapas, korekta człowieka, minima).
CREATE TABLE IF NOT EXISTS public.zd_kpi_weekly (
  supplier_id uuid NOT NULL REFERENCES public.suppliers(id) ON DELETE CASCADE,
  week_start date NOT NULL,
  metrics jsonb NOT NULL DEFAULT '{}'::jsonb,
  computed_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (supplier_id, week_start)
);

ALTER TABLE public.zd_sku_class DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.zd_kpi_weekly DISABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'ontime_app') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON public.zd_sku_class, public.zd_kpi_weekly TO ontime_app;
  END IF;
END
$$;
