-- Pytania handlowców: opcjonalny kontekst produktu (symbol, nazwa, Subiekt tw_Id).

ALTER TABLE department_board_threads
  ADD COLUMN IF NOT EXISTS product_symbol TEXT,
  ADD COLUMN IF NOT EXISTS product_name TEXT,
  ADD COLUMN IF NOT EXISTS subiekt_tw_id INTEGER,
  ADD COLUMN IF NOT EXISTS mikran_code TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'department_board_threads_product_symbol_len_chk'
  ) THEN
    ALTER TABLE department_board_threads
      ADD CONSTRAINT department_board_threads_product_symbol_len_chk
        CHECK (product_symbol IS NULL OR char_length(trim(product_symbol)) <= 100);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'department_board_threads_product_name_len_chk'
  ) THEN
    ALTER TABLE department_board_threads
      ADD CONSTRAINT department_board_threads_product_name_len_chk
        CHECK (product_name IS NULL OR char_length(product_name) <= 500);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'department_board_threads_mikran_code_len_chk'
  ) THEN
    ALTER TABLE department_board_threads
      ADD CONSTRAINT department_board_threads_mikran_code_len_chk
        CHECK (mikran_code IS NULL OR char_length(trim(mikran_code)) <= 32);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS department_board_threads_question_product_symbol_idx
  ON department_board_threads (product_symbol)
  WHERE kind = 'question' AND product_symbol IS NOT NULL;

COMMENT ON COLUMN department_board_threads.product_symbol IS
  'Symbol towaru z Subiekta — kontekst pytania handlowca.';
COMMENT ON COLUMN department_board_threads.product_name IS
  'Nazwa towaru — kontekst pytania handlowca.';
COMMENT ON COLUMN department_board_threads.subiekt_tw_id IS
  'Identyfikator towaru w Subiekcie (tw_Id), gdy wybrano z katalogu.';
COMMENT ON COLUMN department_board_threads.mikran_code IS
  'Kod Mikran (tw_PLU) powiązany z produktem w pytaniu.';
