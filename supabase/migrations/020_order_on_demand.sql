-- Dostawcy zamawiani tylko na zgłoszenie / w razie potrzeby (bez stałego cyklu w panelu).
ALTER TABLE suppliers
  ADD COLUMN IF NOT EXISTS order_on_demand BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_suppliers_order_on_demand
  ON suppliers (order_on_demand)
  WHERE order_on_demand = true;

COMMENT ON COLUMN suppliers.order_on_demand IS
  'Zamówienia ad hoc — nie pokazuj w harmonogramie tygodnia; lista w panelu dziennym.';
