-- 167_individual_orders_already_ordered.sql
-- „Już zamówione” w panelu dziennym: prośba na towar zamówiony wcześniej.
-- Pozycja przechodzi jak uzupełniające, ale nie tworzy próbki czasu dostawy
-- (ordered_at = kliknięcie, nie realne złożenie zamówienia — zaniżałoby historię).

ALTER TABLE public.individual_orders
  ADD COLUMN IF NOT EXISTS already_ordered boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.individual_orders.already_ordered IS
  'Oznaczone w panelu jako „Już zamówione” — wykluczone z delivery_stats.';

-- Próbki już policzone dla takich zamówień (gdyby flagę ustawiono ręcznie) — soft-delete.
UPDATE public.delivery_stats_samples s
SET deleted_at = now()
FROM public.individual_orders o
WHERE s.order_id = o.id
  AND o.already_ordered
  AND s.deleted_at IS NULL;
