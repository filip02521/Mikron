-- Jednorazowy pakiet: rezygnacja handlowca + klient końcowy (jeśli 014–017 nie były wdrożone osobno).
ALTER TABLE individual_orders
  ADD COLUMN IF NOT EXISTS sales_cancelled_at TIMESTAMPTZ;

ALTER TABLE individual_orders
  ADD COLUMN IF NOT EXISTS sales_cancel_phase TEXT;

ALTER TABLE individual_orders
  ADD COLUMN IF NOT EXISTS sales_client_name TEXT;

CREATE INDEX IF NOT EXISTS idx_individual_orders_sales_cancelled
  ON individual_orders (sales_cancelled_at DESC)
  WHERE sales_cancelled_at IS NOT NULL;

UPDATE individual_orders
SET sales_cancel_phase = CASE
  WHEN status = 'Anulowane' THEN 'before_order'
  WHEN status = 'Zrealizowane' THEN 'on_stock'
  WHEN status = 'Czesciowo_zrealizowane' AND COALESCE(NULLIF(delivered_quantity, '-'), '0')::numeric > 0 THEN 'on_stock'
  WHEN status IN ('Zamowione', 'Czesciowo_zrealizowane') THEN 'in_transit'
  ELSE 'before_order'
END
WHERE sales_cancelled_at IS NOT NULL
  AND sales_cancel_phase IS NULL;
