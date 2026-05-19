-- Grupowanie wielu pozycji z jednego zgłoszenia / jednej akcji w panelu
ALTER TABLE individual_orders
  ADD COLUMN IF NOT EXISTS submission_group_id UUID,
  ADD COLUMN IF NOT EXISTS placement_group_id UUID;

CREATE INDEX IF NOT EXISTS idx_individual_orders_submission_group
  ON individual_orders (submission_group_id)
  WHERE submission_group_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_individual_orders_placement_group
  ON individual_orders (placement_group_id)
  WHERE placement_group_id IS NOT NULL;

NOTIFY pgrst, 'reload schema';
