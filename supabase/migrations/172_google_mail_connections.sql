-- 172_google_mail_connections.sql
-- Wysyłka ZD do dostawcy z firmowego Gmaila użytkownika (OAuth, zakres gmail.send):
-- połączenie (refresh token szyfrowany w aplikacji, AES-256-GCM), podpis maila, ślad wysłanych ZD.

CREATE TABLE IF NOT EXISTS public.google_mail_connections (
  user_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  google_email text NOT NULL,
  refresh_token_enc text NOT NULL,
  scope text NOT NULL DEFAULT '',
  connected_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.google_mail_connections IS
  'Gmail użytkownika OnTime (tylko wysyłka). Usunięcie wiersza = odłączenie; token odwoływany w Google przy odłączeniu.';

-- Podpis doklejany do treści maila (Gmail API nie dodaje podpisu ze skrzynki).
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS email_signature text NOT NULL DEFAULT '';

-- Ślad „to ZD poszło do dostawcy” — ostrzeżenie przed ponowną wysyłką po odświeżeniu strony.
CREATE TABLE IF NOT EXISTS public.supplier_order_emails (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subiekt_dok_id integer NOT NULL,
  dok_nr text NOT NULL DEFAULT '',
  supplier_id uuid NOT NULL REFERENCES public.suppliers(id) ON DELETE CASCADE,
  sent_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  from_address text NOT NULL,
  to_addresses text[] NOT NULL DEFAULT '{}',
  attachment_name text NOT NULL DEFAULT '',
  gmail_message_id text,
  sent_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS supplier_order_emails_dok_idx
  ON public.supplier_order_emails (subiekt_dok_id, sent_at DESC);

DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'ontime_app') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON public.google_mail_connections TO ontime_app;
    GRANT SELECT, INSERT ON public.supplier_order_emails TO ontime_app;
  END IF;
END
$$;
