-- Granty dla ontime_app (F0/F1). Bezpieczne gdy rola nie istnieje (dev docker = ontime_app jest ownerem).

DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'ontime_app') THEN
    GRANT USAGE ON SCHEMA public TO ontime_app;
    GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO ontime_app;
    GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO ontime_app;
    GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO ontime_app;
  END IF;
END
$$;
