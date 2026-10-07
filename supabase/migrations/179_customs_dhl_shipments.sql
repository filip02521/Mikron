-- 179_customs_dhl_shipments.sql
-- Odprawy DHL Express z maili: jedna przesyłka = jeden AWB, niezależnie od tego, ile kopii
-- (skrzynki, przekazania Fwd:, ponaglenia) przyszło. Pierwsza prośba agencji (T#…) zakłada
-- odprawę: faktura z załącznika, odczyt AI, dostawca, pozycje i propozycje opisów/CN.
-- Skrzynka wspólna (np. office@) — połączenie Gmail niezależne od konta osoby, tylko odczyt.

CREATE TABLE IF NOT EXISTS public.customs_dhl_shipments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  awb text NOT NULL UNIQUE CHECK (awb ~ '^[0-9]{10}$'),
  -- Numer sprawy agencji z tematu (T#…), bez „T#”.
  ticket text,
  -- Oryginalna prośba agencji: odpowiedź idzie w tym wątku (Re: <temat>, In-Reply-To).
  request_subject text,
  request_rfc_message_id text,
  request_mailbox text,
  request_gmail_message_id text,
  request_gmail_thread_id text,
  first_seen_at timestamptz NOT NULL DEFAULT now(),
  -- Pierwsza prośba / pytanie / ponaglenie agencji = dzień przybycia na magazyn DHL (3 dni bez opłat,
  -- zwrot po 10 dniach). NULL = znamy przesyłkę tylko z komunikatów (cło, zwolnienie) — nie czeka na nas.
  requested_at timestamptz,
  -- Pliki <AWB>.INV.* z maili (PDF albo TIFF; bywa kilka, w tym sam certyfikat):
  -- [{ path, name, mime, size }] w buckecie customs-documents.
  invoice_files jsonb NOT NULL DEFAULT '[]'::jsonb,
  -- Odczyt AI pliku z pozycjami (InvoiceExtraction + file) — do założenia odprawy, także bez dostawcy.
  extraction jsonb,
  supplier_id uuid REFERENCES public.suppliers(id) ON DELETE SET NULL,
  clearance_id uuid REFERENCES public.customs_clearances(id) ON DELETE SET NULL,
  -- Etap: request (czeka na odpowiedź) → replied → confirmed → declared (ZCX91) → released (429).
  stage text NOT NULL DEFAULT 'request'
    CHECK (stage IN ('request', 'replied', 'confirmed', 'declared', 'released')),
  reminder_count integer NOT NULL DEFAULT 0,
  last_reminder_at timestamptz,
  duties_due_at timestamptz,
  duties_paid_at timestamptz,
  delivered_at timestamptz,
  mrn text,
  last_event_at timestamptz,
  -- Ostatni błąd automatu (brak faktury, AI niedostępne, nie rozpoznano dostawcy…).
  note text,
  dismissed_at timestamptz,
  dismissed_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS customs_dhl_shipments_open_idx
  ON public.customs_dhl_shipments (requested_at DESC)
  WHERE dismissed_at IS NULL AND stage = 'request';
CREATE INDEX IF NOT EXISTS customs_dhl_shipments_clearance_idx
  ON public.customs_dhl_shipments (clearance_id);

-- Każda wiadomość raz — po Message-ID, więc ta sama wiadomość w kilku skrzynkach liczy się raz.
CREATE TABLE IF NOT EXISTS public.customs_dhl_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shipment_id uuid NOT NULL REFERENCES public.customs_dhl_shipments(id) ON DELETE CASCADE,
  rfc_message_id text NOT NULL UNIQUE,
  mailbox text NOT NULL,
  gmail_message_id text NOT NULL,
  gmail_thread_id text NOT NULL,
  kind text NOT NULL,
  forwarded boolean NOT NULL DEFAULT false,
  customs_code text,
  from_address text NOT NULL DEFAULT '',
  subject text NOT NULL DEFAULT '',
  received_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS customs_dhl_events_shipment_idx
  ON public.customs_dhl_events (shipment_id, received_at);

-- Skrzynka wspólna (office@…): podłącza admin / zakupy, token szyfrowany jak w google_mail_connections.
CREATE TABLE IF NOT EXISTS public.google_shared_mailboxes (
  google_email text PRIMARY KEY,
  refresh_token_enc text NOT NULL,
  scope text NOT NULL DEFAULT '',
  connected_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  connected_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Odprawa założona z maila DHL: odpowiedź do agencji w wątku prośby.
ALTER TABLE public.customs_clearances ADD COLUMN IF NOT EXISTS dhl_shipment_id uuid
  REFERENCES public.customs_dhl_shipments(id) ON DELETE SET NULL;

DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'ontime_app') THEN
    GRANT SELECT, INSERT, UPDATE ON public.customs_dhl_shipments TO ontime_app;
    GRANT SELECT, INSERT ON public.customs_dhl_events TO ontime_app;
    GRANT SELECT, INSERT, UPDATE, DELETE ON public.google_shared_mailboxes TO ontime_app;
  END IF;
END
$$;
