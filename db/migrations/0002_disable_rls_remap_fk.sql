-- Remap FK auth.users → app_users + wyłączenie RLS (F1 overlay).

DO $$
DECLARE r RECORD;
BEGIN
  -- Wyłącz RLS na wszystkich tabelach public
  FOR r IN
    SELECT tablename FROM pg_tables WHERE schemaname = 'public'
  LOOP
    EXECUTE format('ALTER TABLE public.%I DISABLE ROW LEVEL SECURITY', r.tablename);
  END LOOP;
END
$$;

-- Przepnij FK na app_users (idempotentnie)
DO $$
DECLARE
  rec RECORD;
BEGIN
  FOR rec IN
    SELECT
      conrelid::regclass AS tbl,
      conname,
      a.attname AS col
    FROM pg_constraint c
    JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = ANY (c.conkey)
    JOIN pg_class ref ON ref.oid = c.confrelid
    JOIN pg_namespace nsp ON nsp.oid = ref.relnamespace
    WHERE c.contype = 'f'
      AND nsp.nspname = 'auth'
      AND ref.relname = 'users'
  LOOP
    EXECUTE format('ALTER TABLE %s DROP CONSTRAINT IF EXISTS %I', rec.tbl, rec.conname);
    BEGIN
      EXECUTE format(
        'ALTER TABLE %s ADD CONSTRAINT %I FOREIGN KEY (%I) REFERENCES app_users(id) ON DELETE SET NULL',
        rec.tbl, rec.conname, rec.col
      );
    EXCEPTION WHEN duplicate_object THEN
      NULL;
    END;
  END LOOP;
END
$$;

-- profiles.id powinien CASCADE
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='profiles'
  ) THEN
    ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_id_fkey;
    ALTER TABLE profiles
      ADD CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES app_users(id) ON DELETE CASCADE;
  END IF;
EXCEPTION WHEN duplicate_object THEN
  NULL;
END
$$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='password_reset_otps'
  ) THEN
    ALTER TABLE password_reset_otps DROP CONSTRAINT IF EXISTS password_reset_otps_user_id_fkey;
    ALTER TABLE password_reset_otps
      ADD CONSTRAINT password_reset_otps_user_id_fkey
      FOREIGN KEY (user_id) REFERENCES app_users(id) ON DELETE CASCADE;
  END IF;
EXCEPTION WHEN others THEN
  NULL;
END
$$;

DROP SCHEMA IF EXISTS private CASCADE;
