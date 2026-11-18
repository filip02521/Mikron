-- Tablica: pytanie handlowca może dotyczyć kilku produktów naraz.
-- Pierwszy produkt zostaje w kolumnach wątku (product_symbol, product_name, subiekt_tw_id, mikran_code),
-- więc stare odczyty działają bez zmian; kolejne trafiają tutaj, w kolejności z formularza.

CREATE TABLE IF NOT EXISTS public.department_board_thread_products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id uuid NOT NULL REFERENCES public.department_board_threads(id) ON DELETE CASCADE,
  -- 2, 3, … — pozycja 1 to produkt w kolumnach wątku.
  position smallint NOT NULL CHECK (position BETWEEN 2 AND 50),
  product_symbol text NULL,
  product_name text NULL,
  subiekt_tw_id integer NULL CHECK (subiekt_tw_id IS NULL OR subiekt_tw_id > 0),
  mikran_code text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT department_board_thread_products_any_chk CHECK (
    coalesce(product_symbol, product_name, mikran_code) IS NOT NULL OR subiekt_tw_id IS NOT NULL
  ),
  UNIQUE (thread_id, position)
);

ALTER TABLE public.department_board_thread_products DISABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'ontime_app') THEN
    GRANT SELECT, INSERT, DELETE ON public.department_board_thread_products TO ontime_app;
  END IF;
END
$$;
