-- Zlecenia serwisowe: sprzęt klienta przyjęty do naprawy, części pobrane do zlecenia (RW wystawiane
-- ręcznie w Subiekcie, numer RW zapisany tutaj) i katalog części dla modelu (BOM).

CREATE TABLE IF NOT EXISTS public.service_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- ZS/RR/MM/NNN — licznik w miesiącu przyjęcia.
  number text NOT NULL UNIQUE,
  client_kh_id integer NULL,
  client_name text NOT NULL,
  client_phone text NULL,
  -- Model z Subiekta, gdy jest w kartotece; sprzęt spoza niej ma tylko nazwę.
  device_tw_id integer NULL CHECK (device_tw_id IS NULL OR device_tw_id > 0),
  device_symbol text NULL,
  device_name text NOT NULL,
  serial_no text NULL,
  fault text NOT NULL,
  accessories text NOT NULL DEFAULT '',
  work_note text NOT NULL DEFAULT '',
  due_date date NULL,
  status text NOT NULL DEFAULT 'przyjete'
    CHECK (status IN ('przyjete', 'diagnoza', 'w_naprawie', 'czeka_na_czesc', 'gotowe', 'wydane', 'anulowane')),
  loaner_unit_id uuid NULL REFERENCES public.service_loaner_units(id) ON DELETE SET NULL,
  rw_number text NULL,
  rw_at timestamptz NULL,
  closed_at timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid NULL,
  CONSTRAINT service_orders_client_len CHECK (char_length(client_name) BETWEEN 1 AND 200),
  CONSTRAINT service_orders_fault_len CHECK (char_length(fault) BETWEEN 1 AND 1000)
);

CREATE INDEX IF NOT EXISTS service_orders_status_idx ON public.service_orders (status, created_at DESC);
CREATE INDEX IF NOT EXISTS service_orders_device_idx ON public.service_orders (device_tw_id);

-- Historia zlecenia: tylko dopisywana.
CREATE TABLE IF NOT EXISTS public.service_order_events (
  id bigserial PRIMARY KEY,
  order_id uuid NOT NULL REFERENCES public.service_orders(id) ON DELETE CASCADE,
  at timestamptz NOT NULL DEFAULT now(),
  type text NOT NULL
    CHECK (type IN ('created', 'status', 'part_taken', 'part_returned', 'loaner_linked', 'loaner_unlinked', 'rw', 'note')),
  from_status text NULL,
  to_status text NULL,
  note text NOT NULL DEFAULT '',
  actor_id uuid NULL,
  actor_name text NULL
);

CREATE INDEX IF NOT EXISTS service_order_events_order_at_idx ON public.service_order_events (order_id, at DESC);

-- Części pobrane do zlecenia. Wiersz można cofnąć (usunąć) tylko przed wpisaniem RW — pilnuje aplikacja.
CREATE TABLE IF NOT EXISTS public.service_order_parts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.service_orders(id) ON DELETE CASCADE,
  part_tw_id integer NOT NULL CHECK (part_tw_id > 0),
  part_symbol text NULL,
  part_name text NOT NULL,
  quantity integer NOT NULL CHECK (quantity > 0 AND quantity <= 9999),
  taken_at timestamptz NOT NULL DEFAULT now(),
  taken_by uuid NULL,
  taken_by_name text NULL
);

CREATE INDEX IF NOT EXISTS service_order_parts_order_idx ON public.service_order_parts (order_id);
CREATE INDEX IF NOT EXISTS service_order_parts_tw_idx ON public.service_order_parts (part_tw_id);

-- Katalog części dla modelu (BOM): co zwykle idzie do naprawy danego sprzętu.
CREATE TABLE IF NOT EXISTS public.service_model_parts (
  model_tw_id integer NOT NULL CHECK (model_tw_id > 0),
  model_symbol text NULL,
  model_name text NOT NULL,
  part_tw_id integer NOT NULL CHECK (part_tw_id > 0),
  part_symbol text NULL,
  part_name text NOT NULL,
  default_qty integer NOT NULL DEFAULT 1 CHECK (default_qty > 0 AND default_qty <= 999),
  note text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid NULL,
  PRIMARY KEY (model_tw_id, part_tw_id)
);

ALTER TABLE public.service_orders DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_order_events DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_order_parts DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_model_parts DISABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'ontime_app') THEN
    GRANT SELECT, INSERT, UPDATE ON public.service_orders TO ontime_app;
    GRANT SELECT, INSERT ON public.service_order_events TO ontime_app;
    REVOKE UPDATE, DELETE ON public.service_order_events FROM ontime_app;
    GRANT USAGE, SELECT ON SEQUENCE public.service_order_events_id_seq TO ontime_app;
    GRANT SELECT, INSERT, DELETE ON public.service_order_parts TO ontime_app;
    GRANT SELECT, INSERT, UPDATE, DELETE ON public.service_model_parts TO ontime_app;
  END IF;
END
$$;
