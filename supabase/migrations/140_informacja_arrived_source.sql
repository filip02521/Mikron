-- Skąd zamknięto prośbę informacyjną: ręcznie (magazyn) lub automatycznie (stan Subiekta).
ALTER TABLE individual_orders
  ADD COLUMN IF NOT EXISTS informacja_arrived_source text
  CHECK (
    informacja_arrived_source IS NULL
    OR informacja_arrived_source IN ('manual', 'stock_auto')
  );

COMMENT ON COLUMN individual_orders.informacja_arrived_source IS
  'Skąd zamknięto prośbę informacyjną: ręcznie (magazyn) lub automatycznie (stan Subiekta).';
