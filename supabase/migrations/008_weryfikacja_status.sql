-- Niekompletne zgłoszenia — uzupełnienie przez zakupy / admin przed zamówieniem u dostawcy
-- Enum w osobnej migracji (PostgreSQL wymaga commit przed użyciem nowej wartości)
ALTER TYPE individual_order_status ADD VALUE IF NOT EXISTS 'Weryfikacja';
NOTIFY pgrst, 'reload schema';
