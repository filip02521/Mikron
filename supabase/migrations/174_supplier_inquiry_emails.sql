-- 174_supplier_inquiry_emails.sql
-- Tablica: „Zapytaj dostawcę” — ślad maili do dostawcy o cenę / dostępność / termin wysłanych z wątku pytania.
-- resolved_at = zakupy odpisały w wątku po wysłaniu (wątek przestaje „czekać na dostawcę”).

CREATE TABLE IF NOT EXISTS public.supplier_inquiry_emails (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id uuid NOT NULL REFERENCES public.department_board_threads(id) ON DELETE CASCADE,
  supplier_id uuid REFERENCES public.suppliers(id) ON DELETE SET NULL,
  supplier_name text NOT NULL,
  sent_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  from_address text NOT NULL,
  to_addresses text[] NOT NULL DEFAULT '{}',
  subject text NOT NULL DEFAULT '',
  gmail_message_id text,
  sent_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz
);

CREATE INDEX IF NOT EXISTS supplier_inquiry_emails_thread_idx
  ON public.supplier_inquiry_emails (thread_id, sent_at DESC);

CREATE INDEX IF NOT EXISTS supplier_inquiry_emails_pending_idx
  ON public.supplier_inquiry_emails (thread_id)
  WHERE resolved_at IS NULL;

DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'ontime_app') THEN
    GRANT SELECT, INSERT, UPDATE ON public.supplier_inquiry_emails TO ontime_app;
  END IF;
END
$$;
