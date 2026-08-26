-- Wielokrotność liczby paczek na ZD (tryb packages).
-- Po ceil(need/N) dobij liczbę jednostek dokumentu do wielokrotności M.
-- NULL = wyłączone (jak dotychczas).

ALTER TABLE public.zd_estimate_packaging
  ADD COLUMN IF NOT EXISTS order_multiple integer NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'zd_estimate_packaging_order_multiple_check'
  ) THEN
    ALTER TABLE public.zd_estimate_packaging
      ADD CONSTRAINT zd_estimate_packaging_order_multiple_check
      CHECK (
        order_multiple IS NULL
        OR (order_multiple >= 2 AND order_multiple <= 100000)
      );
  END IF;
END $$;

COMMENT ON COLUMN public.zd_estimate_packaging.order_multiple IS
  'Wielokrotność liczby paczek na ZD (tryb packages). NULL = bez dodatkowego dobicia.';

NOTIFY pgrst, 'reload schema';
