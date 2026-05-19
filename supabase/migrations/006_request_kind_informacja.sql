-- Prośba informacyjna: powiadom handlowca gdy towar jest na magazynie (bez zamówienia u dostawcy)
DO $$
BEGIN
  CREATE TYPE individual_request_kind AS ENUM ('zamowienie', 'informacja');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE individual_orders
  ADD COLUMN IF NOT EXISTS request_kind individual_request_kind NOT NULL DEFAULT 'zamowienie';

CREATE INDEX IF NOT EXISTS idx_individual_orders_request_kind
  ON individual_orders (request_kind, status);

-- Odśwież cache PostgREST (Supabase)
NOTIFY pgrst, 'reload schema';
