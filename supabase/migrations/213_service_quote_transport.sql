-- Serwis: kilka zleceń na jedno zgłoszenie helpdesku (zgłoszenie bywa na kilka urządzeń), wycena z decyzją
-- klienta (status „czeka na decyzję klienta”) i transport w obie strony (jak sprzęt przyszedł i jak wrócił).

-- Jedno zgłoszenie = wiele zleceń (np. dwie prostnice w #4583): zwykły indeks zamiast unikalnego.
DROP INDEX IF EXISTS public.service_orders_helpdesk_live_idx;
CREATE INDEX IF NOT EXISTS service_orders_helpdesk_idx ON public.service_orders (helpdesk_id) WHERE helpdesk_id IS NOT NULL;

ALTER TABLE public.service_orders DROP CONSTRAINT IF EXISTS service_orders_status_check;
ALTER TABLE public.service_orders
  ADD CONSTRAINT service_orders_status_check
  CHECK (status IN ('przyjete', 'diagnoza', 'czeka_na_akceptacje', 'w_naprawie', 'czeka_na_czesc', 'gotowe', 'wydane', 'anulowane'));

-- Wycena po diagnozie: kwota brutto (zł), co obejmuje, kiedy wysłana; decyzja klienta i kiedy.
ALTER TABLE public.service_orders
  ADD COLUMN IF NOT EXISTS quote_amount numeric(10, 2) NULL CHECK (quote_amount IS NULL OR (quote_amount >= 0 AND quote_amount < 1000000)),
  ADD COLUMN IF NOT EXISTS quote_note text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS quote_sent_at timestamptz NULL,
  ADD COLUMN IF NOT EXISTS quote_decision text NULL CHECK (quote_decision IS NULL OR quote_decision IN ('accepted', 'rejected')),
  ADD COLUMN IF NOT EXISTS quote_decided_at timestamptz NULL;

-- Transport: jak sprzęt przyszedł (i kiedy kurier miał go odebrać) i jak wrócił do klienta.
ALTER TABLE public.service_orders
  ADD COLUMN IF NOT EXISTS inbound_method text NULL
    CHECK (inbound_method IS NULL OR inbound_method IN ('kurier_klienta', 'odbior_mikran', 'osobiscie')),
  ADD COLUMN IF NOT EXISTS inbound_pickup_date date NULL,
  ADD COLUMN IF NOT EXISTS outbound_method text NULL
    CHECK (outbound_method IS NULL OR outbound_method IN ('gls', 'inny_kurier', 'osobiscie')),
  ADD COLUMN IF NOT EXISTS outbound_tracking text NULL CHECK (outbound_tracking IS NULL OR char_length(outbound_tracking) <= 60),
  ADD COLUMN IF NOT EXISTS outbound_address text NULL CHECK (outbound_address IS NULL OR char_length(outbound_address) <= 300);

ALTER TABLE public.service_order_events DROP CONSTRAINT IF EXISTS service_order_events_type_check;
ALTER TABLE public.service_order_events
  ADD CONSTRAINT service_order_events_type_check
  CHECK (type IN ('created', 'status', 'part_taken', 'part_returned', 'loaner_linked', 'loaner_unlinked', 'rw', 'note',
                  'invoice', 'invoice_cleared', 'waiting_part', 'quote', 'quote_decision', 'shipment'));
