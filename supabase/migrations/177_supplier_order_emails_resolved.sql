-- 177_supplier_order_emails_resolved.sql
-- „Czeka na dostawcę”: wysłane ZD znika z listy po odpowiedzi dostawcy albo po ręcznym „Załatwione”
-- (np. dostawca potwierdził telefonicznie). resolved_by = kto zamknął ręcznie.

ALTER TABLE public.supplier_order_emails
  ADD COLUMN IF NOT EXISTS resolved_at timestamptz,
  ADD COLUMN IF NOT EXISTS resolved_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS supplier_order_emails_pending_idx
  ON public.supplier_order_emails (sent_at DESC)
  WHERE resolved_at IS NULL;

DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'ontime_app') THEN
    GRANT UPDATE ON public.supplier_order_emails TO ontime_app;
  END IF;
END
$$;
