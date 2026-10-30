-- 206_rol_sends.sql
-- Historia wysyłek zgłoszeń ROL (docs/plans/rol-ivoclar-zgloszenia.md, plasterek 5): jedna wiadomość = jedna
-- paczka klienta; uzupełnienie to kolejny wiersz tej samej paczki. Pliki generujemy przy wysyłce —
-- tu zostaje, co dokładnie wyszło (nazwy, rozmiary, sha256), adresaci i identyfikatory z Gmaila.
CREATE TABLE IF NOT EXISTS public.rol_sends (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id uuid NOT NULL REFERENCES public.rol_batches(id) ON DELETE CASCADE,
  sent_by uuid NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
  sent_at timestamptz NOT NULL DEFAULT now(),
  from_address text NOT NULL DEFAULT '',
  gmail_message_id text NOT NULL DEFAULT '',
  gmail_thread_id text NULL,
  to_emails text[] NOT NULL,
  cc_emails text[] NOT NULL DEFAULT '{}',
  subject text NOT NULL,
  body text NOT NULL,
  attachments jsonb NOT NULL DEFAULT '[]'::jsonb,
  kind text NOT NULL DEFAULT 'zgloszenie',
  CONSTRAINT rol_sends_kind CHECK (kind IN ('zgloszenie', 'uzupelnienie', 'reczne', 'automat'))
);

CREATE INDEX IF NOT EXISTS rol_sends_batch_idx ON public.rol_sends (batch_id, sent_at DESC);

ALTER TABLE public.rol_sends DISABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'ontime_app') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON public.rol_sends TO ontime_app;
  END IF;
END
$$;
