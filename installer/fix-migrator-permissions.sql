-- Naprawa uprawnień ontime_migrator na produkcji.
-- Uruchom jako postgres superuser:
--   psql -U postgres -d ontime -f installer/fix-migrator-permissions.sql
--
-- Rozwiązuje błędy w panelu migracji admina:
--   „odmowa dostępu do schematu public” / „… schematu storage”
--   „must be owner of table …” (tabele należące do postgres po pg_restore)
-- Skrypt jest idempotentny — można go uruchamiać wielokrotnie.

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

-- 9. Schemat storage (stub po Supabase) — „odmowa dostępu do schematu storage”
--    przy migracjach, które dotykają storage.buckets (np. 156). Aplikacja trzyma
--    pliki lokalnie, ale migracje historyczne wpisują tam rekordy bucketów.
DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_namespace WHERE nspname = 'storage') THEN
    EXECUTE 'GRANT USAGE ON SCHEMA storage TO ontime_migrator';
    EXECUTE 'GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA storage TO ontime_migrator';
  END IF;
  IF EXISTS (SELECT FROM pg_namespace WHERE nspname = 'auth') THEN
    EXECUTE 'GRANT USAGE ON SCHEMA auth TO ontime_migrator';
    EXECUTE 'GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA auth TO ontime_migrator';
  END IF;
END
$$;

-- 10. Właściciel obiektów w public → ontime_migrator.
--     ALTER TABLE / ALTER TYPE / CREATE OR REPLACE FUNCTION wymagają bycia
--     WŁAŚCICIELEM — samo GRANT ALL nie wystarcza („must be owner of table …”).
--     Po pg_restore jako postgres tabele należą do postgres, więc panel migracji
--     (ontime_migrator) nie może ich zmieniać.
--     Najpierw nadajemy ontime_app jawne DML, żeby po zmianie właściciela
--     aplikacja nie straciła dostępu (np. gdy ontime_app był właścicielem).
GRANT USAGE ON SCHEMA public TO ontime_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO ontime_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO ontime_app;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO ontime_app;

DO $$
DECLARE
  r record;
BEGIN
  -- Tabele, widoki, widoki zmaterializowane (sekwencje SERIAL przechodzą razem z tabelą).
  FOR r IN
    SELECT c.oid::regclass AS obj, c.relkind
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relkind IN ('r', 'p', 'v', 'm')
      AND pg_get_userbyid(c.relowner) <> 'ontime_migrator'
      AND NOT EXISTS (
        SELECT 1 FROM pg_depend d
        WHERE d.classid = 'pg_class'::regclass AND d.objid = c.oid AND d.deptype = 'e'
      )
  LOOP
    IF r.relkind = 'v' THEN
      EXECUTE format('ALTER VIEW %s OWNER TO ontime_migrator', r.obj);
    ELSIF r.relkind = 'm' THEN
      EXECUTE format('ALTER MATERIALIZED VIEW %s OWNER TO ontime_migrator', r.obj);
    ELSE
      EXECUTE format('ALTER TABLE %s OWNER TO ontime_migrator', r.obj);
    END IF;
  END LOOP;

  -- Samodzielne sekwencje (niepowiązane z kolumną tabeli).
  FOR r IN
    SELECT c.oid::regclass AS obj
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relkind = 'S'
      AND pg_get_userbyid(c.relowner) <> 'ontime_migrator'
      AND NOT EXISTS (
        SELECT 1 FROM pg_depend d
        WHERE d.classid = 'pg_class'::regclass AND d.objid = c.oid AND d.deptype IN ('a', 'i', 'e')
      )
  LOOP
    EXECUTE format('ALTER SEQUENCE %s OWNER TO ontime_migrator', r.obj);
  END LOOP;

  -- Funkcje / procedury (bez należących do rozszerzeń, np. pg_trgm).
  FOR r IN
    SELECT p.oid::regprocedure AS obj, p.prokind
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND pg_get_userbyid(p.proowner) <> 'ontime_migrator'
      AND NOT EXISTS (
        SELECT 1 FROM pg_depend d
        WHERE d.classid = 'pg_proc'::regclass AND d.objid = p.oid AND d.deptype = 'e'
      )
  LOOP
    IF r.prokind = 'p' THEN
      EXECUTE format('ALTER PROCEDURE %s OWNER TO ontime_migrator', r.obj);
    ELSIF r.prokind = 'a' THEN
      EXECUTE format('ALTER AGGREGATE %s OWNER TO ontime_migrator', r.obj);
    ELSE
      EXECUTE format('ALTER FUNCTION %s OWNER TO ontime_migrator', r.obj);
    END IF;
  END LOOP;

  -- Typy (enumy, domeny, typy złożone) — ALTER TYPE … ADD VALUE wymaga właściciela.
  FOR r IN
    SELECT t.oid::regtype AS obj, t.typtype
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public'
      AND t.typtype IN ('e', 'd', 'c')
      AND pg_get_userbyid(t.typowner) <> 'ontime_migrator'
      AND (t.typtype <> 'c' OR (SELECT relkind FROM pg_class WHERE oid = t.typrelid) = 'c')
      AND NOT EXISTS (
        SELECT 1 FROM pg_depend d
        WHERE d.classid = 'pg_type'::regclass AND d.objid = t.oid AND d.deptype = 'e'
      )
  LOOP
    IF r.typtype = 'd' THEN
      EXECUTE format('ALTER DOMAIN %s OWNER TO ontime_migrator', r.obj);
    ELSE
      EXECUTE format('ALTER TYPE %s OWNER TO ontime_migrator', r.obj);
    END IF;
  END LOOP;
END
$$;

-- 11. Obiekty tworzone PRZEZ ontime_migrator (panel migracji) → ontime_app dostaje DML.
--     Bez tego nowa tabela z migracji (np. supplier_customs_documents z 156)
--     kończy się w aplikacji błędem „permission denied for table …”.
ALTER DEFAULT PRIVILEGES FOR ROLE ontime_migrator IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO ontime_app;
ALTER DEFAULT PRIVILEGES FOR ROLE ontime_migrator IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO ontime_app;
ALTER DEFAULT PRIVILEGES FOR ROLE ontime_migrator IN SCHEMA public
  GRANT EXECUTE ON FUNCTIONS TO ontime_app;

-- 12. Ponowne DML dla ontime_app PO zmianie właściciela (krok 10).
--     Jeśli ontime_app był właścicielem tabeli, jego uprawnienia właściciela
--     przeszły na ontime_migrator — trzeba je nadać jawnie jeszcze raz.
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO ontime_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO ontime_app;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO ontime_app;
