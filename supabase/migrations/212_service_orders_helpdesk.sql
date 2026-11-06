-- Zlecenie serwisowe założone ze zgłoszenia helpdesku sklepu mikran.pl: numer zgłoszenia (service_id
-- w helpdesku). Jedno zgłoszenie = najwyżej jedno żywe zlecenie; anulowane zwalnia numer.

ALTER TABLE public.service_orders
  ADD COLUMN IF NOT EXISTS helpdesk_id integer NULL CHECK (helpdesk_id IS NULL OR helpdesk_id > 0);

CREATE UNIQUE INDEX IF NOT EXISTS service_orders_helpdesk_live_idx
  ON public.service_orders (helpdesk_id)
  WHERE helpdesk_id IS NOT NULL AND status <> 'anulowane';
