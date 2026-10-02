-- 159_customs_clearance_agency_email.sql
-- Wysyłka maila do agencji celnej z aplikacji: adres agencji i identyfikator wysłanej wiadomości.

ALTER TABLE public.customs_clearances
  ADD COLUMN IF NOT EXISTS agency_email text,
  ADD COLUMN IF NOT EXISTS sent_message_id text;

COMMENT ON COLUMN public.customs_clearances.agency_email IS
  'Adres(y) agencji celnej, na które wysłano mail z odprawą (rozdzielone przecinkiem).';
