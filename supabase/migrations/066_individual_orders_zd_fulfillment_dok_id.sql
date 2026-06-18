-- Twardy link do dopasowanego dokumentu ZD (stabilniejsze ponowne dopasowanie).

ALTER TABLE individual_orders
  ADD COLUMN IF NOT EXISTS zd_fulfillment_dok_id BIGINT NULL;

COMMENT ON COLUMN individual_orders.zd_fulfillment_dok_id IS
  'Identyfikator dopasowanego dokumentu ZD (dok_Id) w Subiekcie.';
