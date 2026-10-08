-- 173_price_list_imports.sql
-- Zakupy → Cenniki: wgrany cennik dostawcy, porównanie z cenami w Subiekcie i ślad zapisu.
-- Jeden wiersz pozycji = jeden towar z cechy dostawcy; old_* to ceny z podglądu, after_* odczyt po zapisie.

CREATE TABLE IF NOT EXISTS public.price_list_imports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  file_name text NOT NULL,
  cecha_id integer NOT NULL,
  cecha_name text NOT NULL,
  host_kind text NOT NULL CHECK (host_kind IN ('live', 'orders_test')),
  valid_from date,
  threshold_pct numeric(5, 2) NOT NULL DEFAULT 5,
  column_map jsonb NOT NULL DEFAULT '{}'::jsonb,
  pricelist_rows integer NOT NULL DEFAULT 0,
  pricelist_unmatched integer NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS price_list_imports_created_at_idx
  ON public.price_list_imports (created_at DESC);

CREATE TABLE IF NOT EXISTS public.price_list_items (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  import_id uuid NOT NULL REFERENCES public.price_list_imports(id) ON DELETE CASCADE,
  tw_id integer NOT NULL,
  tw_symbol text NOT NULL,
  tw_name text NOT NULL DEFAULT '',
  pl_name text,
  pl_row integer,
  pack_factor integer NOT NULL DEFAULT 1 CHECK (pack_factor >= 1),
  vat_subiekt numeric(5, 2),
  vat_list numeric(5, 2),
  list_discount numeric(5, 2),
  old_purchase numeric(14, 4),
  old_retail numeric(14, 4),
  new_purchase numeric(14, 2),
  new_retail numeric(14, 2),
  flags text[] NOT NULL DEFAULT '{}',
  selected boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('not_in_list', 'pending', 'applied', 'changed', 'failed', 'mismatch')),
  error text,
  after_purchase numeric(14, 4),
  after_retail numeric(14, 4),
  applied_at timestamptz,
  applied_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  UNIQUE (import_id, tw_id)
);

CREATE INDEX IF NOT EXISTS price_list_items_import_status_idx
  ON public.price_list_items (import_id, status);

COMMENT ON TABLE public.price_list_items IS
  'Pozycja cennika vs Subiekt. status: pending → applied | mismatch (zapis inny niż cennik) | changed (ktoś zmienił cenę po podglądzie) | failed; not_in_list = towar cechy bez pozycji w cenniku.';
COMMENT ON COLUMN public.price_list_items.list_discount IS
  'Upust dostawcy z cennika w % = docelowa marża Mikranu: (detal − zakup) / detal.';
COMMENT ON COLUMN public.price_list_items.pack_factor IS
  'Cennik podaje karton (np. 20x500 g), Subiekt sprzedaje sztukę — cena z cennika dzielona przez ten mnożnik.';

DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'ontime_app') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON public.price_list_imports, public.price_list_items TO ontime_app;
  END IF;
END
$$;
