-- Naprawa uprawnień ontime_migrator na produkcji.
-- Uruchom jako postgres superuser:
--   psql -U postgres -d ontime -f installer/fix-migrator-permissions.sql
--
-- Rozwiązuje błąd „odmowa dostępu do schematu public" w panelu migracji admina.

-- 1. ontime_migrator musi mieć CREATE i USAGE na schemacie public
GRANT USAGE, CREATE ON SCHEMA public TO ontime_migrator;

-- 2. ontime_migrator musi mieć pełne uprawnienia na wszystkich tabelach
--    (niezależnie od tego, kto je stworzył — pg_restore, ontime_app, postgres)
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO ontime_migrator;

-- 3. ontime_migrator musi mieć uprawnienia na sekwencjach
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO ontime_migrator;

-- 4. ontime_migrator musi mieć EXECUTE na funkcjach
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO ontime_migrator;

-- 5. Domyślne uprawnienia dla przyszłych tabel stworzonych przez ontime_app
--    (gdy ontime_app tworzy tabelę, ontime_migrator automatycznie dostaje ALL)
ALTER DEFAULT PRIVILEGES FOR ROLE ontime_app IN SCHEMA public
  GRANT ALL PRIVILEGES ON TABLES TO ontime_migrator;
ALTER DEFAULT PRIVILEGES FOR ROLE ontime_app IN SCHEMA public
  GRANT ALL PRIVILEGES ON SEQUENCES TO ontime_migrator;
ALTER DEFAULT PRIVILEGES FOR ROLE ontime_app IN SCHEMA public
  GRANT EXECUTE ON FUNCTIONS TO ontime_migrator;

-- 6. Domyślne uprawnienia dla przyszłych tabel stworzonych przez postgres
--    (tylko jeśli rola postgres istnieje)
DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'postgres') THEN
    ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
      GRANT ALL PRIVILEGES ON TABLES TO ontime_migrator;
    ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
      GRANT ALL PRIVILEGES ON SEQUENCES TO ontime_migrator;
  END IF;
END
$$;

-- 7. ontime_app musi mieć SELECT na schema_migrations (do odczytu statusu)
--    Tylko jeśli tabela istnieje.
DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'schema_migrations') THEN
    GRANT SELECT ON public.schema_migrations TO ontime_app;
  END IF;
END
$$;

-- 8. Przeniesienie ownershipu schema_migrations na ontime_migrator
--    Jeśli schema_migrations została stworzona przez postgres lub ontime_app,
--    ontime_migrator nie może jej DROP/ALTER. To naprawia:
DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'schema_migrations') THEN
    EXECUTE 'ALTER TABLE public.schema_migrations OWNER TO ontime_migrator';
  END IF;
END
$$;
