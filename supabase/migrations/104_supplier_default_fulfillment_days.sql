-- Domyślny okres realizacji (w dniach roboczych) dla dostawcy.
-- Używane np. w dziale zębowym do wyliczania oczekiwanych terminów dostaw.

ALTER TABLE suppliers
  ADD COLUMN IF NOT EXISTS default_fulfillment_days INTEGER NULL;

COMMENT ON COLUMN suppliers.default_fulfillment_days IS
  'Domyślny okres realizacji w dniach roboczych (np. 5 = 5 dni roboczych). NULL = brak wartości.';
