-- Karta „Sprzęt klienta” pokazuje tylko pewny sprzęt. Subiekt nie odróżnia urządzenia od materiału (cechy to marki),
-- a numery seryjne są w wolnym tekście uwag faktury, więc to, czego nie da się rozstrzygnąć z dokumentu, rozstrzyga
-- serwisant jednym kliknięciem — raz, dla wszystkich klientów.

-- Czy model (towar z Subiekta) jest urządzeniem. Brak wiersza = nie wiadomo (chyba że model jest w katalogu serwisu).
CREATE TABLE IF NOT EXISTS public.service_device_models (
  tw_id integer PRIMARY KEY CHECK (tw_id > 0),
  symbol text NULL,
  name text NOT NULL,
  is_device boolean NOT NULL,
  decided_at timestamptz NOT NULL DEFAULT now(),
  decided_by uuid NULL
);

ALTER TABLE public.service_device_models DISABLE ROW LEVEL SECURITY;

-- Do którego towaru na dokumencie należy numer seryjny, gdy uwagi nie wskazują pozycji jednoznacznie.
-- tw_id NULL = numer nie należy do żadnej pozycji (pomyłka w uwagach) — nie pokazujemy go.
CREATE TABLE IF NOT EXISTS public.service_serial_assignments (
  doc_id integer NOT NULL CHECK (doc_id > 0),
  serial_key text NOT NULL CHECK (serial_key <> ''),
  serial text NOT NULL,
  tw_id integer NULL CHECK (tw_id IS NULL OR tw_id > 0),
  decided_at timestamptz NOT NULL DEFAULT now(),
  decided_by uuid NULL,
  PRIMARY KEY (doc_id, serial_key)
);

ALTER TABLE public.service_serial_assignments DISABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'ontime_app') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON public.service_device_models TO ontime_app;
    GRANT SELECT, INSERT, UPDATE, DELETE ON public.service_serial_assignments TO ontime_app;
  END IF;
END
$$;
