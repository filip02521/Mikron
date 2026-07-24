-- ============================================================
-- 108: Add missing indexes on foreign keys
--      Fixes advisor warning: unindexed_foreign_keys
--
--      Only FKs without ANY index (single or composite) starting
--      with the FK column are included. FKs covered by composite
--      indexes are skipped to avoid redundant indexes.
--
--      Using regular CREATE INDEX (not CONCURRENTLY) because:
--      - All tables are small (< 10K rows)
--      - Lock duration is milliseconds
--      - CONCURRENTLY cannot run inside a transaction block
--        and the migration script sends all statements together
--      - IF NOT EXISTS ensures idempotency
-- ============================================================

-- product_events (1495 rows)
CREATE INDEX IF NOT EXISTS idx_product_events_supplier_id
  ON product_events (supplier_id);

-- individual_orders (654 rows)
CREATE INDEX IF NOT EXISTS idx_individual_orders_supplier_id
  ON individual_orders (supplier_id);

CREATE INDEX IF NOT EXISTS idx_individual_orders_teeth_ordered_by
  ON individual_orders (teeth_ordered_by);

-- normal_order_history (510 rows)
CREATE INDEX IF NOT EXISTS idx_normal_order_history_supplier_id
  ON normal_order_history (supplier_id);

-- warehouse_delivery_receipts (385 rows)
CREATE INDEX IF NOT EXISTS idx_warehouse_delivery_receipts_carrier
  ON warehouse_delivery_receipts (carrier);

CREATE INDEX IF NOT EXISTS idx_warehouse_delivery_receipts_created_by
  ON warehouse_delivery_receipts (created_by);

CREATE INDEX IF NOT EXISTS idx_warehouse_delivery_receipts_updated_by
  ON warehouse_delivery_receipts (updated_by);

-- suppliers (202 rows)
CREATE INDEX IF NOT EXISTS idx_suppliers_default_delivery_carrier
  ON suppliers (default_delivery_carrier);

-- warehouse_carrier_hints (189 rows)
CREATE INDEX IF NOT EXISTS idx_warehouse_carrier_hints_carrier
  ON warehouse_carrier_hints (carrier);

-- department_board_reads (160 rows)
CREATE INDEX IF NOT EXISTS idx_department_board_reads_profile_id
  ON department_board_reads (profile_id);

-- department_board_threads (37 rows)
CREATE INDEX IF NOT EXISTS idx_department_board_threads_sales_person_id
  ON department_board_threads (sales_person_id);

CREATE INDEX IF NOT EXISTS idx_department_board_threads_created_by
  ON department_board_threads (created_by);

CREATE INDEX IF NOT EXISTS idx_department_board_threads_closed_by
  ON department_board_threads (closed_by);

-- prosba_teeth_products (30 rows)
CREATE INDEX IF NOT EXISTS idx_prosba_teeth_products_created_by
  ON prosba_teeth_products (created_by);

-- sales_bug_reports (19 rows)
CREATE INDEX IF NOT EXISTS idx_sales_bug_reports_profile_id
  ON sales_bug_reports (profile_id);

-- profiles (19 rows)
CREATE INDEX IF NOT EXISTS idx_profiles_sales_person_id
  ON profiles (sales_person_id);

-- department_board_posts (small)
CREATE INDEX IF NOT EXISTS idx_department_board_posts_created_by
  ON department_board_posts (created_by);

-- sales_vacation_delegations (small)
CREATE INDEX IF NOT EXISTS idx_sales_vacation_delegations_created_by
  ON sales_vacation_delegations (created_by);

-- vacations (small)
CREATE INDEX IF NOT EXISTS idx_vacations_supplier_id
  ON vacations (supplier_id);
