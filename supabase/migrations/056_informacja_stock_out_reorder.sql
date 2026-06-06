ALTER TABLE individual_orders
  ADD COLUMN IF NOT EXISTS informacja_stock_out_reorder BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN individual_orders.informacja_stock_out_reorder IS
  'Informacja: towar skończył się na stanie — zakupy zamawiają u dostawcy (panel Dziś), bez powiadomienia handlowca i bez kolejki informacji magazynu.';

CREATE INDEX IF NOT EXISTS idx_individual_orders_informacja_stock_out
  ON individual_orders (informacja_stock_out_reorder)
  WHERE request_kind = 'informacja' AND informacja_stock_out_reorder = true;
