-- Auto-fulfill existing sales cancellations that are stuck in the queue
-- without disposition or warehouse acknowledgment.
-- These orders will no longer appear in /kolejka — goods go to stock automatically.
--
-- SAFETY: Only touch orders where sales_acknowledged_at IS NOT NULL
-- AND status is Zrealizowane or Anulowane (full cancellations).
-- Partial cancellations (Czesciowo_zrealizowane) with active supplier fulfillment
-- do NOT have sales_acknowledged_at set (mergeSalesCancelUserAutoAck skips them
-- because isSalesCancelNoticePending returns false when hasActiveSupplierFulfillment).
-- Excluding Czesciowo_zrealizowane adds an extra safety layer.

UPDATE individual_orders
SET
  procurement_cancel_disposition = COALESCE(procurement_cancel_disposition, 'to_stock'),
  procurement_cancel_disposition_at = COALESCE(procurement_cancel_disposition_at, now()),
  procurement_sales_cancel_ack_at = COALESCE(procurement_sales_cancel_ack_at, now()),
  warehouse_cancel_fulfilled_at = COALESCE(warehouse_cancel_fulfilled_at, now())
WHERE sales_cancelled_at IS NOT NULL
  AND sales_acknowledged_at IS NOT NULL
  AND (procurement_cancel_disposition IS NULL OR warehouse_cancel_fulfilled_at IS NULL)
  AND status IN ('Zrealizowane', 'Anulowane');
