-- Domyślny kurier dostawcy (dziennik magazynu) — ustawiane w panelu dostawców.

ALTER TABLE suppliers
  ADD COLUMN IF NOT EXISTS default_delivery_carrier warehouse_carrier NULL,
  ADD COLUMN IF NOT EXISTS default_delivery_shipment_form warehouse_shipment_form NULL;

COMMENT ON COLUMN suppliers.default_delivery_carrier IS
  'Stały kurier przy wpisie w dzienniku dostaw (nadpisuje naukę z historii).';
COMMENT ON COLUMN suppliers.default_delivery_shipment_form IS
  'Domyślna forma wysyłki w dzienniku dostaw (paczki/palety).';
