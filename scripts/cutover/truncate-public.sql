-- Czyszczenie danych przed ponownym importem (schema zostaje).
BEGIN;
TRUNCATE TABLE app_sessions, auth_tokens, app_user_invites, app_users CASCADE;
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN
    SELECT tablename
    FROM pg_tables
    WHERE schemaname = 'public'
      AND tablename NOT IN ('schema_migrations', 'app_users', 'app_sessions', 'auth_tokens', 'app_user_invites')
  LOOP
    EXECUTE format('TRUNCATE TABLE public.%I CASCADE', r.tablename);
  END LOOP;
END $$;
COMMIT;
