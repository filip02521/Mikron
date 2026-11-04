-- Zlecenia serwisowe: dokumenty przy wydaniu (faktura za naprawę) i część, na którą zlecenie czeka.

ALTER TABLE public.service_orders
  -- Faktura za naprawę: z listy FS klienta (dok_Id + numer) albo numer wpisany ręcznie (bez dok_Id).
  ADD COLUMN IF NOT EXISTS fs_id integer NULL CHECK (fs_id IS NULL OR fs_id > 0),
  ADD COLUMN IF NOT EXISTS fs_number text NULL,
  ADD COLUMN IF NOT EXISTS fs_at timestamptz NULL,
  -- Naprawa bez faktury (gwarancja, bezpłatna) — z powodem; zamyka brak faktury na liście dokumentów.
  ADD COLUMN IF NOT EXISTS no_invoice_reason text NULL,
  -- Część, na którą zlecenie czeka (status „czeka na część”); prośbę do zakupów znajdujemy po uwadze z numerem ZS.
  ADD COLUMN IF NOT EXISTS waiting_part_tw_id integer NULL CHECK (waiting_part_tw_id IS NULL OR waiting_part_tw_id > 0),
  ADD COLUMN IF NOT EXISTS waiting_part_symbol text NULL,
  ADD COLUMN IF NOT EXISTS waiting_part_name text NULL,
  ADD COLUMN IF NOT EXISTS waiting_part_qty integer NULL CHECK (waiting_part_qty IS NULL OR (waiting_part_qty > 0 AND waiting_part_qty <= 9999)),
  ADD COLUMN IF NOT EXISTS waiting_since timestamptz NULL;

ALTER TABLE public.service_orders DROP CONSTRAINT IF EXISTS service_orders_invoice_xor;
ALTER TABLE public.service_orders
  ADD CONSTRAINT service_orders_invoice_xor CHECK (fs_number IS NULL OR no_invoice_reason IS NULL);

ALTER TABLE public.service_order_events DROP CONSTRAINT IF EXISTS service_order_events_type_check;
ALTER TABLE public.service_order_events
  ADD CONSTRAINT service_order_events_type_check
  CHECK (type IN ('created', 'status', 'part_taken', 'part_returned', 'loaner_linked', 'loaner_unlinked', 'rw', 'note',
                  'invoice', 'invoice_cleared', 'waiting_part'));
