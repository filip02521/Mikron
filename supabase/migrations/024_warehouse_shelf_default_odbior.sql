-- Domyślna strefa magazynu dla pozycji do odbioru
ALTER TABLE individual_orders
  ALTER COLUMN warehouse_shelf SET DEFAULT 'Odbiór';

UPDATE individual_orders
SET warehouse_shelf = 'Odbiór'
WHERE warehouse_shelf IS NULL OR btrim(warehouse_shelf) = '';

COMMENT ON COLUMN individual_orders.warehouse_shelf IS
  'Lokalizacja na magazynie (regał / strefa); domyślnie strefa Odbiór';
