-- Informacja: najpierw kolejka „Dla kogoś” w panelu dziennym (Główne/Uzupełniające), potem magazyn.
ALTER TABLE individual_orders
  ADD COLUMN IF NOT EXISTS informacja_queue_via_daily_panel BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN individual_orders.informacja_queue_via_daily_panel IS
  'true = prośba informacyjna czeka w panelu Dziś (zamów u dostawcy) zanim trafi do kolejki magazynu / regału.';

CREATE INDEX IF NOT EXISTS idx_individual_orders_informacja_via_panel
  ON individual_orders (informacja_queue_via_daily_panel)
  WHERE request_kind = 'informacja' AND informacja_queue_via_daily_panel = true;
