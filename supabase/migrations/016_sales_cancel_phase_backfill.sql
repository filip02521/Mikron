-- Uzupełnienie fazy dla rekordów sprzed migracji 015 (opcjonalne, logika w aplikacji też wnioskuje fazę).
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
