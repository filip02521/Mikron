-- 180_supplier_mail_case_idx.sql
-- Licznik Poczty dostawców (co kilkadziesiąt sekund u każdej osoby z zakupów) szuka po samym case_id —
-- indeks (case_kind, case_id) z 178 do tego się nie nadaje.

CREATE INDEX IF NOT EXISTS supplier_mail_messages_case_id_idx
  ON public.supplier_mail_messages (case_id)
  WHERE case_id IS NOT NULL;
