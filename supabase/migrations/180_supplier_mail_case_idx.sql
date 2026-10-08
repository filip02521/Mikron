-- 180_supplier_mail_case_idx.sql
-- Licznik Poczty dostawców (co kilkadziesiąt sekund u każdej osoby z zakupów) szuka po samym case_id —
-- indeks (case_kind, case_id) z 178 do tego się nie nadaje.

CREATE INDEX IF NOT EXISTS supplier_mail_messages_case_id_idx
  ON public.supplier_mail_messages (case_id)
  WHERE case_id IS NOT NULL;

-- Skrzynka po adresie (załączniki Poczty, połączenie nadawcy wysyłki) — lower(google_email) w zapytaniach.
CREATE INDEX IF NOT EXISTS google_mail_connections_email_idx
  ON public.google_mail_connections (lower(google_email));
