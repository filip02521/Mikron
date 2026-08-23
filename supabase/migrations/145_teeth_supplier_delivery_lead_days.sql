-- Stałe ETA dostawy (dni robocze) per dostawca toru zębów.
-- NULL = szacunek z historii zrealizowanych zamówień zębowych.

ALTER TABLE public.teeth_supplier_schedules
  ADD COLUMN IF NOT EXISTS delivery_lead_business_days integer NULL;

ALTER TABLE public.teeth_supplier_schedules
  DROP CONSTRAINT IF EXISTS teeth_supplier_schedules_delivery_lead_nonneg;

ALTER TABLE public.teeth_supplier_schedules
  ADD CONSTRAINT teeth_supplier_schedules_delivery_lead_nonneg
  CHECK (delivery_lead_business_days IS NULL OR delivery_lead_business_days >= 0);

COMMENT ON COLUMN public.teeth_supplier_schedules.delivery_lead_business_days IS
  'Stałe dni robocze od zamówienia u dostawcy do planowanej dostawy; NULL = ETA z historii zębów.';
