-- Atomowe przejmowanie blokady (bez race przy równoległym sync/cron)

CREATE OR REPLACE FUNCTION public.try_acquire_job_lock(
  p_key text,
  p_ttl_seconds int DEFAULT 30,
  p_locked_by text DEFAULT 'system'
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_until timestamptz := now() + make_interval(secs => p_ttl_seconds);
  v_updated int;
BEGIN
  INSERT INTO job_locks (key, locked_until, locked_by)
  VALUES (p_key, v_until, p_locked_by)
  ON CONFLICT (key) DO UPDATE
    SET locked_until = EXCLUDED.locked_until,
        locked_by = EXCLUDED.locked_by
    WHERE job_locks.locked_until < now();

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  IF v_updated > 0 THEN
    RETURN true;
  END IF;

  RETURN false;
END;
$$;
