-- Częściowa rezygnacja handlowca z ilości (reszta u dostawcy).
ALTER TABLE individual_orders
  ADD COLUMN IF NOT EXISTS sales_cancelled_quantity TEXT DEFAULT NULL;

COMMENT ON COLUMN individual_orders.sales_cancelled_quantity IS
  'Ilość wycofana przez handlowca (szt.). NULL = pełna rezygnacja wg dotychczasowych reguł.';
