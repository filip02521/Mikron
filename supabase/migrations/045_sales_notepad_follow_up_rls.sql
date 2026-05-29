-- Notatnik: daty follow-up + RLS dla handlowców (defense in depth).

ALTER TABLE sales_payment_watches
  ADD COLUMN IF NOT EXISTS follow_up_at DATE;

ALTER TABLE sales_notes
  ADD COLUMN IF NOT EXISTS follow_up_at DATE;

CREATE INDEX IF NOT EXISTS sales_payment_watches_follow_up_idx
  ON sales_payment_watches (sales_person_id, follow_up_at)
  WHERE settled_at IS NULL AND archived_at IS NULL;

CREATE INDEX IF NOT EXISTS sales_notes_follow_up_idx
  ON sales_notes (sales_person_id, follow_up_at)
  WHERE archived_at IS NULL;

COMMENT ON COLUMN sales_payment_watches.follow_up_at IS
  'Opcjonalna data przypomnienia / follow-up dla handlowca.';

COMMENT ON COLUMN sales_notes.follow_up_at IS
  'Opcjonalna data przypomnienia / follow-up dla handlowca.';

CREATE POLICY sales_notes_own ON sales_notes
  FOR ALL
  USING (
    public.is_sales_account()
    AND sales_person_id = public.my_sales_person_id()
  )
  WITH CHECK (
    public.is_sales_account()
    AND sales_person_id = public.my_sales_person_id()
  );

CREATE POLICY sales_payment_watches_own ON sales_payment_watches
  FOR ALL
  USING (
    public.is_sales_account()
    AND sales_person_id = public.my_sales_person_id()
  )
  WITH CHECK (
    public.is_sales_account()
    AND sales_person_id = public.my_sales_person_id()
  );
