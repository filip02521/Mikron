-- 163_zd_scope_order.sql
-- Porządek w zakresach dostawców (Kreator ZD / panel Braki). Zakresem nadal są
-- WYŁĄCZNIE ręcznie przypisane grupy/cechy — nic tu nie dokłada towarów spoza nich.
--
-- 1. Kilka zakresów na dostawcę: zd_estimate_supplier_scopes dostaje własne id;
--    unikalność (dostawca, tryb, grupa/cecha). Kolejność = sort_order, potem created_at
--    (pierwszy = główny — z nim zapisuje się historia ZD).
-- 2. zd_product_supplier_assignments — towar ze wspólnego zakresu zamawiany u wskazanego
--    dostawcy (u pozostałych znika z listy „Do ZD”).
-- 3. subiekt_product_scope_index / subiekt_scope_names — indeks towar → grupa / cechy
--    z Subiekta (odczyt), źródło podpowiedzi mapowań.

-- 1) Wiele zakresów na dostawcę -------------------------------------------------

ALTER TABLE public.zd_estimate_supplier_scopes
  ADD COLUMN IF NOT EXISTS id uuid NOT NULL DEFAULT gen_random_uuid(),
  ADD COLUMN IF NOT EXISTS sort_order integer NOT NULL DEFAULT 0;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
      FROM pg_constraint c
      JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = ANY (c.conkey)
     WHERE c.conrelid = 'public.zd_estimate_supplier_scopes'::regclass
       AND c.contype = 'p'
       AND a.attname = 'supplier_id'
  ) THEN
    ALTER TABLE public.zd_estimate_supplier_scopes
      DROP CONSTRAINT zd_estimate_supplier_scopes_pkey;
    ALTER TABLE public.zd_estimate_supplier_scopes
      ADD CONSTRAINT zd_estimate_supplier_scopes_pkey PRIMARY KEY (id);
  END IF;
END
$$;

CREATE UNIQUE INDEX IF NOT EXISTS zd_estimate_supplier_scopes_unique_scope
  ON public.zd_estimate_supplier_scopes (supplier_id, mode, COALESCE(grupa_id, cecha_id));

CREATE INDEX IF NOT EXISTS zd_estimate_supplier_scopes_supplier_idx
  ON public.zd_estimate_supplier_scopes (supplier_id, sort_order, created_at);

-- 2) Towar ze wspólnego zakresu → dostawca ------------------------------------

CREATE TABLE IF NOT EXISTS public.zd_product_supplier_assignments (
  subiekt_tw_id integer PRIMARY KEY,
  supplier_id uuid NOT NULL REFERENCES public.suppliers(id) ON DELETE CASCADE,
  tw_symbol text NULL,
  tw_nazwa text NOT NULL DEFAULT '',
  note text NOT NULL DEFAULT '',
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
  CONSTRAINT zd_product_supplier_assignments_note_len CHECK (char_length(note) <= 500)
);

CREATE INDEX IF NOT EXISTS zd_product_supplier_assignments_supplier_idx
  ON public.zd_product_supplier_assignments (supplier_id);

-- 3) Indeks towar → grupa / cechy (Subiekt) --------------------------------------

CREATE TABLE IF NOT EXISTS public.subiekt_product_scope_index (
  subiekt_tw_id integer PRIMARY KEY,
  grupa_id integer NULL,
  cecha_ids integer[] NOT NULL DEFAULT '{}',
  synced_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS subiekt_product_scope_index_grupa_idx
  ON public.subiekt_product_scope_index (grupa_id);
CREATE INDEX IF NOT EXISTS subiekt_product_scope_index_cechy_idx
  ON public.subiekt_product_scope_index USING gin (cecha_ids);

CREATE TABLE IF NOT EXISTS public.subiekt_scope_names (
  kind text NOT NULL,
  scope_id integer NOT NULL,
  name text NOT NULL DEFAULT '',
  product_count integer NOT NULL DEFAULT 0,
  synced_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (kind, scope_id),
  CONSTRAINT subiekt_scope_names_kind_check CHECK (kind IN ('grupa', 'cecha'))
);

ALTER TABLE public.zd_product_supplier_assignments DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.subiekt_product_scope_index DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.subiekt_scope_names DISABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'ontime_app') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON
      public.zd_product_supplier_assignments,
      public.subiekt_product_scope_index,
      public.subiekt_scope_names
    TO ontime_app;
  END IF;
END
$$;
