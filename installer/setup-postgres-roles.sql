-- F0: role i bazy OnTime (uruchom jako superuser postgres).
-- psql -U postgres -f installer/setup-postgres-roles.sql

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'ontime_migrator') THEN
    CREATE ROLE ontime_migrator LOGIN PASSWORD 'CHANGE_ME_MIGRATOR' CREATEDB;
  END IF;
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'ontime_app') THEN
    CREATE ROLE ontime_app LOGIN PASSWORD 'CHANGE_ME_APP' NOSUPERUSER NOCREATEDB;
  END IF;
END
$$;

SELECT 'CREATE DATABASE ontime OWNER ontime_migrator ENCODING ''UTF8'''
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'ontime')\gexec

SELECT 'CREATE DATABASE ontime_staging OWNER ontime_migrator ENCODING ''UTF8'''
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'ontime_staging')\gexec

\c ontime
GRANT USAGE ON SCHEMA public TO ontime_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO ontime_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO ontime_app;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO ontime_app;
ALTER DEFAULT PRIVILEGES FOR ROLE ontime_migrator IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO ontime_app;
ALTER DEFAULT PRIVILEGES FOR ROLE ontime_migrator IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO ontime_app;
ALTER DEFAULT PRIVILEGES FOR ROLE ontime_migrator IN SCHEMA public
  GRANT EXECUTE ON FUNCTIONS TO ontime_app;

\c ontime_staging
GRANT USAGE ON SCHEMA public TO ontime_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO ontime_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO ontime_app;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO ontime_app;
ALTER DEFAULT PRIVILEGES FOR ROLE ontime_migrator IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO ontime_app;
ALTER DEFAULT PRIVILEGES FOR ROLE ontime_migrator IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO ontime_app;
ALTER DEFAULT PRIVILEGES FOR ROLE ontime_migrator IN SCHEMA public
  GRANT EXECUTE ON FUNCTIONS TO ontime_app;
