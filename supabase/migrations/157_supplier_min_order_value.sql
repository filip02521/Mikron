-- 157_supplier_min_order_value.sql
-- Minimalna wartość zamówienia u dostawcy — opcjonalne pole w karcie dostawcy.
-- min_order_value: kwota (nullable; NULL = brak minimum).
-- min_order_currency: symbol waluty (nullable; domyślnie PLN przy zapisie z wartością).

ALTER TABLE public.suppliers
  ADD COLUMN IF NOT EXISTS min_order_value numeric(12, 2),
  ADD COLUMN IF NOT EXISTS min_order_currency text;

COMMENT ON COLUMN public.suppliers.min_order_value IS
  'Minimalna wartość zamówienia wymagana przez dostawcę (kwota). NULL = brak minimum.';
COMMENT ON COLUMN public.suppliers.min_order_currency IS
  'Symbol waluty dla min_order_value (np. PLN, EUR, USD). NULL gdy brak minimum.';
