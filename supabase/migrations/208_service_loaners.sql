-- Sprzęt zastępczy: egzemplarze wydawane klientom na czas naprawy ich maszyny.
-- Towar (model) jest w Subiekcie; który egzemplarz jest u którego klienta wie tylko OnTime.

CREATE TABLE IF NOT EXISTS public.service_loaner_units (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Własny numer (ZAST-001) albo numer seryjny — to, co jest na naklejce sprzętu.
  code text NOT NULL,
  serial_no text NULL,
  subiekt_tw_id integer NOT NULL CHECK (subiekt_tw_id > 0),
  tw_symbol text NULL,
  tw_name text NOT NULL DEFAULT '',
  condition text NOT NULL DEFAULT 'dobry',
  status text NOT NULL DEFAULT 'na_stanie'
    CHECK (status IN ('na_stanie', 'u_klienta', 'przeglad', 'wycofany')),
  current_kh_id integer NULL,
  current_client_name text NULL,
  current_client_phone text NULL,
  current_since timestamptz NULL,
  planned_return date NULL,
  note text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid NULL,
  CONSTRAINT service_loaner_units_code_len CHECK (char_length(code) BETWEEN 1 AND 60),
  CONSTRAINT service_loaner_units_at_client CHECK (
    (status = 'u_klienta') = (current_client_name IS NOT NULL AND current_since IS NOT NULL)
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS service_loaner_units_code_lower_idx
  ON public.service_loaner_units (lower(trim(code)));
CREATE INDEX IF NOT EXISTS service_loaner_units_tw_idx
  ON public.service_loaner_units (subiekt_tw_id);

-- Historia egzemplarza: tylko dopisywana (aplikacja ma INSERT/SELECT, bez UPDATE/DELETE).
CREATE TABLE IF NOT EXISTS public.service_loaner_events (
  id bigserial PRIMARY KEY,
  unit_id uuid NOT NULL REFERENCES public.service_loaner_units(id) ON DELETE CASCADE,
  at timestamptz NOT NULL DEFAULT now(),
  type text NOT NULL
    CHECK (type IN ('created', 'issued', 'returned', 'extended', 'service_start', 'service_end', 'retired')),
  kh_id integer NULL,
  client_name text NULL,
  planned_return date NULL,
  condition text NULL,
  note text NOT NULL DEFAULT '',
  actor_id uuid NULL,
  actor_name text NULL
);

CREATE INDEX IF NOT EXISTS service_loaner_events_unit_at_idx
  ON public.service_loaner_events (unit_id, at DESC);

ALTER TABLE public.service_loaner_units DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_loaner_events DISABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'ontime_app') THEN
    GRANT SELECT, INSERT, UPDATE ON public.service_loaner_units TO ontime_app;
    GRANT SELECT, INSERT ON public.service_loaner_events TO ontime_app;
    REVOKE UPDATE, DELETE ON public.service_loaner_events FROM ontime_app;
    GRANT USAGE, SELECT ON SEQUENCE public.service_loaner_events_id_seq TO ontime_app;
  END IF;
END
$$;
