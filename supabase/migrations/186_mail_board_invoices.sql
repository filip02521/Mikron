-- 186_mail_board_invoices.sql
-- Tablica spraw: osobna kolumna „Faktury” (do wpisania do Subiekta z terminem płatności, płaci księgowość)
-- obok „Do zapłaty” (tylko przedpłaty: proforma, należności celne — przekazanie do zapłaty od razu).

ALTER TABLE public.mail_board_items DROP CONSTRAINT IF EXISTS mail_board_items_board_column_check;
ALTER TABLE public.mail_board_items
  ADD CONSTRAINT mail_board_items_board_column_check
  CHECK (board_column IN ('todo', 'doing', 'waiting', 'invoices', 'to_pay', 'done'));
