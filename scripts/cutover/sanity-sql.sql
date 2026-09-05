-- Sanity checks po imporcie (plan §6.3). Uruchom: psql $DATABASE_URL -f scripts/cutover/sanity-sql.sql

\echo '=== Liczności kluczowe ==='
SELECT 'app_users' AS t, COUNT(*)::bigint AS n FROM app_users
UNION ALL SELECT 'profiles', COUNT(*) FROM profiles
UNION ALL SELECT 'individual_orders', COUNT(*) FROM individual_orders
UNION ALL SELECT 'suppliers', COUNT(*) FROM suppliers
UNION ALL SELECT 'sales_people', COUNT(*) FROM sales_people
UNION ALL SELECT 'department_board_threads', COUNT(*) FROM department_board_threads
ORDER BY 1;

\echo '=== Role (profiles) ==='
SELECT role, COUNT(*) FROM profiles GROUP BY role ORDER BY role;

\echo '=== Orphan profiles (MUSI = 0) ==='
SELECT COUNT(*) AS orphan_profiles
FROM profiles p
LEFT JOIN app_users u ON u.id = p.id
WHERE u.id IS NULL;

\echo '=== Orphan supplier FK (individual_orders) ==='
SELECT COUNT(*) AS orphan_supplier_fk
FROM individual_orders
WHERE supplier_id IS NOT NULL
  AND supplier_id NOT IN (SELECT id FROM suppliers);

\echo '=== Orphan FK auth→app_users (§A.2, MUSI = 0) ==='
SELECT 'teeth_supplier_shortages' AS t, COUNT(*)::bigint AS n
FROM teeth_supplier_shortages
WHERE created_by IS NOT NULL AND created_by NOT IN (SELECT id FROM app_users)
UNION ALL
SELECT 'external_warehouse_line_meta', COUNT(*)
FROM external_warehouse_line_meta
WHERE updated_by IS NOT NULL AND updated_by NOT IN (SELECT id FROM app_users)
UNION ALL
SELECT 'external_warehouse_notes', COUNT(*)
FROM external_warehouse_notes
WHERE created_by IS NOT NULL AND created_by NOT IN (SELECT id FROM app_users)
UNION ALL
SELECT 'external_warehouse_change_log', COUNT(*)
FROM external_warehouse_change_log
WHERE actor_user_id IS NOT NULL AND actor_user_id NOT IN (SELECT id FROM app_users)
UNION ALL
SELECT 'external_warehouse_line_pallet_shares', COUNT(*)
FROM external_warehouse_line_pallet_shares
WHERE updated_by IS NOT NULL AND updated_by NOT IN (SELECT id FROM app_users)
UNION ALL
SELECT 'password_reset_otps', COUNT(*)
FROM password_reset_otps
WHERE user_id NOT IN (SELECT id FROM app_users);

\echo '=== RPC (3 funkcje biznesowe) ==='
SELECT proname FROM pg_proc
WHERE proname IN (
  'try_acquire_job_lock',
  'increment_delivery_stats',
  'replace_external_warehouse_line_pallet_shares'
)
ORDER BY 1;

\echo '=== Bcrypt w app_users ==='
SELECT
  COUNT(*) FILTER (WHERE password_hash LIKE '$2a$%' OR password_hash LIKE '$2b$%') AS bcrypt_ok,
  COUNT(*) AS total
FROM app_users;
