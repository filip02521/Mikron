-- Opcjonalna etykieta klienta końcowego (ustawiana przez handlowca).
ALTER TABLE individual_orders
  ADD COLUMN IF NOT EXISTS sales_client_name TEXT;

COMMENT ON COLUMN individual_orders.sales_client_name IS
  'Imię/firma klienta końcowego — tylko dla handlowca (Moje zamówienia, e-maile o dostawie).';
