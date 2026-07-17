ALTER TABLE individual_orders ADD COLUMN IF NOT EXISTS warehouse_cleared_at timestamptz;
ALTER TABLE individual_orders ADD COLUMN IF NOT EXISTS warehouse_cleared_by text;
