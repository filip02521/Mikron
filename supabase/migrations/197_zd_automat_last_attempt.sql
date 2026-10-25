-- 197_zd_automat_last_attempt.sql
-- Panel dzienny → „Automat ZD”: wynik ostatniej próby propozycji dostawcy (nocny przebieg albo „Przygotuj teraz”).
-- Do tej pory „nic do zamówienia”, „wstrzymane” i błąd były tylko w logu serwera — panel nie mógł powiedzieć,
-- czemu dziś nic nie powstało. Zapis tylko dla dostawców w automacie (wiersz z polityką ≠ classic).

ALTER TABLE public.zd_supplier_order_policy
  ADD COLUMN IF NOT EXISTS last_attempt_at timestamptz NULL,
  ADD COLUMN IF NOT EXISTS last_attempt_kind text NULL,
  ADD COLUMN IF NOT EXISTS last_attempt_detail text NULL;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'zd_supplier_order_policy_last_attempt_kind_check') THEN
    ALTER TABLE public.zd_supplier_order_policy
      ADD CONSTRAINT zd_supplier_order_policy_last_attempt_kind_check
      CHECK (last_attempt_kind IS NULL
             OR last_attempt_kind IN ('created', 'nothing_to_order', 'not_due', 'disabled', 'skipped', 'error'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'zd_supplier_order_policy_last_attempt_detail_len') THEN
    ALTER TABLE public.zd_supplier_order_policy
      ADD CONSTRAINT zd_supplier_order_policy_last_attempt_detail_len
      CHECK (last_attempt_detail IS NULL OR char_length(last_attempt_detail) <= 500);
  END IF;
END
$$;
