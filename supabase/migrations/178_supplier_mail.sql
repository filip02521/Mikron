-- 178_supplier_mail.sql
-- Poczta dostawców (Zakupy → Asystent): maile od adresów / domen z kart dostawców i zwroty,
-- zsynchronizowane z połączonych skrzynek Gmail (zakres gmail.readonly), przypięte do sprawy
-- (wysłane ZD albo zapytanie z tablicy). handled_at = ktoś zareagował (odpowiedź, „Załatwione”).

CREATE TABLE IF NOT EXISTS public.supplier_mail_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Skrzynka (google_email połączenia), z której przyszła kopia wiadomości.
  mailbox text NOT NULL,
  owner_user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  gmail_message_id text NOT NULL,
  gmail_thread_id text NOT NULL,
  -- Nagłówek Message-ID: odpowiedź w wątku (In-Reply-To) i ta sama wiadomość w kilku skrzynkach.
  rfc_message_id text,
  supplier_id uuid REFERENCES public.suppliers(id) ON DELETE SET NULL,
  -- supplier = dostawca, auto = autoodpowiedź, bounce = zwrot (mail nie doszedł).
  kind text NOT NULL CHECK (kind IN ('supplier', 'auto', 'bounce')),
  from_address text NOT NULL DEFAULT '',
  from_name text NOT NULL DEFAULT '',
  subject text NOT NULL DEFAULT '',
  snippet text NOT NULL DEFAULT '',
  -- [{ filename, attachmentId, size, mimeType }]
  attachments jsonb NOT NULL DEFAULT '[]'::jsonb,
  received_at timestamptz NOT NULL,
  -- Sprawa: 'zd' (supplier_order_emails.id) albo 'inquiry' (supplier_inquiry_emails.id).
  case_kind text CHECK (case_kind IN ('zd', 'inquiry')),
  case_id uuid,
  -- Jak przypięto: thread (ten sam wątek), document (numer ZD w treści), supplier (ostatnie ZD dostawcy).
  linked_by text CHECK (linked_by IN ('thread', 'document', 'supplier')),
  handled_at timestamptz,
  handled_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  -- reply = odpowiedź z OnTime, gmail = odpowiedź w Gmailu (nasza wiadomość później w wątku),
  -- manual = „Załatwione”, board = odpowiedź handlowcowi w wątku tablicy,
  -- initial = starsze niż doba przy pierwszej synchronizacji skrzynki (bez zaległości na start).
  handled_via text CHECK (handled_via IN ('reply', 'gmail', 'manual', 'board', 'initial')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (mailbox, gmail_message_id)
);

CREATE INDEX IF NOT EXISTS supplier_mail_messages_open_idx
  ON public.supplier_mail_messages (received_at DESC)
  WHERE handled_at IS NULL;
CREATE INDEX IF NOT EXISTS supplier_mail_messages_case_idx
  ON public.supplier_mail_messages (case_kind, case_id);
CREATE INDEX IF NOT EXISTS supplier_mail_messages_supplier_idx
  ON public.supplier_mail_messages (supplier_id, received_at DESC);
CREATE INDEX IF NOT EXISTS supplier_mail_messages_rfc_idx
  ON public.supplier_mail_messages (rfc_message_id);

-- Rodzaj (reply / confirmation → do reakcji; invoice / shipping → dokumenty) i numer ZD z treści
-- (także ZD wysłane poza OnTime — z indeksu Subiekta).
ALTER TABLE public.supplier_mail_messages
  ADD COLUMN IF NOT EXISTS category text NOT NULL DEFAULT 'reply'
    CHECK (category IN ('reply', 'confirmation', 'invoice', 'shipping')),
  ADD COLUMN IF NOT EXISTS zd_dok_nr text,
  ADD COLUMN IF NOT EXISTS zd_dok_id integer;

-- Ostatnia synchronizacja skrzynki — kolejna pobiera tylko nowsze wiadomości.
CREATE TABLE IF NOT EXISTS public.supplier_mail_sync (
  mailbox text PRIMARY KEY,
  synced_at timestamptz NOT NULL,
  last_error text
);

-- Wątek wysłanej wiadomości — odpowiedzi dostawcy w tym samym wątku przypinają się bez zgadywania.
ALTER TABLE public.supplier_order_emails ADD COLUMN IF NOT EXISTS gmail_thread_id text;
ALTER TABLE public.supplier_inquiry_emails ADD COLUMN IF NOT EXISTS gmail_thread_id text;
-- Przypomnienie z Poczty dostawców — termin odpowiedzi liczy się od nowa od tej daty.
ALTER TABLE public.supplier_order_emails ADD COLUMN IF NOT EXISTS reminded_at timestamptz;
ALTER TABLE public.supplier_inquiry_emails ADD COLUMN IF NOT EXISTS reminded_at timestamptz;

DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'ontime_app') THEN
    GRANT SELECT, INSERT, UPDATE ON public.supplier_mail_messages TO ontime_app;
    GRANT SELECT, INSERT, UPDATE ON public.supplier_mail_sync TO ontime_app;
  END IF;
END
$$;
