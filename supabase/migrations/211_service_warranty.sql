-- Gwarancja sprzętu w serwisie. Subiekt nie przechowuje okresu gwarancji (ani na towarze, ani na pozycji FS),
-- więc okres liczy OnTime: domyślnie 24 miesiące od daty zakupu, inny okres dla modelu — w tej tabeli.

CREATE TABLE IF NOT EXISTS public.service_model_warranty (
  model_tw_id integer PRIMARY KEY CHECK (model_tw_id > 0),
  model_symbol text NULL,
  model_name text NOT NULL,
  months integer NOT NULL CHECK (months > 0 AND months <= 120),
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid NULL
);

ALTER TABLE public.service_model_warranty DISABLE ROW LEVEL SECURITY;

-- Zakup i gwarancja zapisane przy przyjęciu: data i dokument (FS/PA z listy sprzętu albo wpisane ręcznie)
-- oraz koniec gwarancji policzony wtedy z okresu modelu — późniejsza zmiana okresu nie przelicza przyjętych zleceń.
ALTER TABLE public.service_orders
  ADD COLUMN IF NOT EXISTS purchase_date date NULL,
  ADD COLUMN IF NOT EXISTS purchase_doc text NULL,
  ADD COLUMN IF NOT EXISTS warranty_until date NULL;

ALTER TABLE public.service_orders DROP CONSTRAINT IF EXISTS service_orders_warranty_needs_purchase;
ALTER TABLE public.service_orders
  ADD CONSTRAINT service_orders_warranty_needs_purchase CHECK (warranty_until IS NULL OR purchase_date IS NOT NULL);

DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'ontime_app') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON public.service_model_warranty TO ontime_app;
  END IF;
END
$$;
