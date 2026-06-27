-- Kolejka opóźnionych powiadomień o dostawie.
-- E-maile są planowane natychmiast, ale wysyłane dopiero po oknie cofania (10 s).
-- Cofnięcie przyjęcia oznacza wpis jako anulowany.

CREATE TABLE IF NOT EXISTS public.delivery_notification_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.individual_orders(id) ON DELETE CASCADE,
  delivered_quantity TEXT NOT NULL,
  status TEXT NOT NULL,
  sales_person_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  send_at TIMESTAMPTZ NOT NULL,
  sent_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_delivery_notification_queue_order
  ON public.delivery_notification_queue (order_id);

CREATE INDEX IF NOT EXISTS idx_delivery_notification_queue_send
  ON public.delivery_notification_queue (sent_at, cancelled_at, send_at)
  WHERE sent_at IS NULL AND cancelled_at IS NULL;

-- Dostęp tylko dla service role / admin (brak RLS — jak inne tabele systemowe).
ALTER TABLE public.delivery_notification_queue ENABLE ROW LEVEL SECURITY;

-- Zezwól service role (supabase admin) na pełny dostęp.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'delivery_notification_queue'
      AND policyname = 'delivery_notification_queue_service_all'
  ) THEN
    CREATE POLICY delivery_notification_queue_service_all
      ON public.delivery_notification_queue
      FOR ALL
      TO service_role
      USING (true)
      WITH CHECK (true);
  END IF;
END
$$;
