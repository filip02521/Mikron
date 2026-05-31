-- Notatnik: spójna nazwa tabeli ZK (było sales_payment_watches) i kolumn.

DROP INDEX IF EXISTS sales_payment_watches_follow_up_idx;

ALTER TABLE sales_payment_watches RENAME TO sales_zk_watches;

ALTER TABLE sales_zk_watches RENAME COLUMN settled_at TO closed_at;

ALTER TABLE sales_zk_watches DROP COLUMN IF EXISTS due_at;

ALTER INDEX IF EXISTS sales_payment_watches_person_active_idx
  RENAME TO sales_zk_watches_person_active_idx;

CREATE INDEX sales_zk_watches_follow_up_idx
  ON sales_zk_watches (sales_person_id, follow_up_at)
  WHERE closed_at IS NULL AND archived_at IS NULL;

COMMENT ON TABLE sales_zk_watches IS
  'Obserwowane ZK oczekujące na towar — sekcja „Czeka na towar” w notatniku handlowca.';

COMMENT ON COLUMN sales_zk_watches.closed_at IS
  'Data zamknięcia sprawy (towar dostarczony / zrealizowane).';

COMMENT ON COLUMN sales_zk_watches.follow_up_at IS
  'Opcjonalna data przypomnienia / follow-up dla handlowca.';

ALTER POLICY sales_payment_watches_admin ON sales_zk_watches
  RENAME TO sales_zk_watches_admin;

ALTER POLICY sales_payment_watches_own ON sales_zk_watches
  RENAME TO sales_zk_watches_own;
