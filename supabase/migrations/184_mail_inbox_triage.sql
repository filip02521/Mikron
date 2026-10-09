-- 184_mail_inbox_triage.sql
-- Tablica spraw z całej skrzynki: wiadomości od nadawców spoza kart dostawców (kind 'other') trafiają na
-- półkę „Do przejrzenia” albo prosto na tablicę, wg reguł nadawców, których tablica uczy się z decyzji.

ALTER TABLE public.supplier_mail_messages DROP CONSTRAINT IF EXISTS supplier_mail_messages_kind_check;
ALTER TABLE public.supplier_mail_messages
  ADD CONSTRAINT supplier_mail_messages_kind_check CHECK (kind IN ('supplier', 'auto', 'bounce', 'other'));

-- Tylko dla kind 'other': review = do przejrzenia, case = sprawa na tablicy, ignored = nie sprawa.
ALTER TABLE public.supplier_mail_messages
  ADD COLUMN IF NOT EXISTS triage text CHECK (triage IN ('review', 'case', 'ignored'));

CREATE INDEX IF NOT EXISTS supplier_mail_messages_review_idx
  ON public.supplier_mail_messages (received_at DESC)
  WHERE triage = 'review';

-- Reguła nadawcy: pełny adres ('jan@firma.pl') albo cała domena ('@firma.pl').
CREATE TABLE IF NOT EXISTS public.mail_sender_rules (
  pattern text PRIMARY KEY,
  decision text NOT NULL CHECK (decision IN ('case', 'ignore')),
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Cała skrzynka od tej chwili (pierwszy raz: kilka dni wstecz) — osobno od maili od dostawców.
ALTER TABLE public.supplier_mail_sync ADD COLUMN IF NOT EXISTS inbox_synced_at timestamptz;

DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'ontime_app') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON public.mail_sender_rules TO ontime_app;
  END IF;
END
$$;
