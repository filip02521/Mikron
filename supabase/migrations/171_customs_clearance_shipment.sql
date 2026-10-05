-- 171_customs_clearance_shipment.sql
-- Przesyłka przy odprawie: spedytor, list przewozowy, terminy i należności.
-- Etap (w drodze → na terminalu → należności → odprawiona → dostarczona) wynika z tych pól w aplikacji.

ALTER TABLE public.customs_clearances
  ADD COLUMN IF NOT EXISTS forwarder text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS transport_ref text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS eta date,
  ADD COLUMN IF NOT EXISTS arrived_at date,
  ADD COLUMN IF NOT EXISTS free_storage_days smallint NOT NULL DEFAULT 3,
  ADD COLUMN IF NOT EXISTS duties_amount numeric(14, 2),
  ADD COLUMN IF NOT EXISTS duties_paid_at date,
  ADD COLUMN IF NOT EXISTS mrn text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS delivered_at date;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'customs_clearances_free_storage_days') THEN
    ALTER TABLE public.customs_clearances
      ADD CONSTRAINT customs_clearances_free_storage_days CHECK (free_storage_days BETWEEN 0 AND 60);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'customs_clearances_duties_amount') THEN
    ALTER TABLE public.customs_clearances
      ADD CONSTRAINT customs_clearances_duties_amount CHECK (duties_amount IS NULL OR duties_amount >= 0);
  END IF;
END
$$;

COMMENT ON COLUMN public.customs_clearances.arrived_at IS
  'Dzień przyjęcia na terminal / magazyn agencji — od niego liczy się wolne składowanie (dzień przybycia się wlicza).';
COMMENT ON COLUMN public.customs_clearances.mrn IS 'Numer zgłoszenia celnego z ZC429 — odprawa zakończona.';
