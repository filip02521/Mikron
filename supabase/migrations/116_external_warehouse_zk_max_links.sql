-- Limit max 10 ZK na site (ochrona race TOCTOU przy równoległym linkowaniu).
-- Advisory lock w transakcji + sprawdzenie BEFORE INSERT.

CREATE OR REPLACE FUNCTION public.external_warehouse_zk_links_enforce_max()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  link_count integer;
BEGIN
  PERFORM pg_advisory_xact_lock(
    hashtext('external_warehouse_zk_links:' || NEW.site_id::text)
  );

  SELECT COUNT(*)::integer INTO link_count
  FROM public.external_warehouse_zk_links
  WHERE site_id = NEW.site_id;

  IF link_count >= 10 THEN
    RAISE EXCEPTION 'max_external_warehouse_zk_links'
      USING ERRCODE = 'check_violation',
            HINT = 'Maksymalnie 10 ZK na magazyn zewnętrzny.';
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.external_warehouse_zk_links_enforce_max() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.external_warehouse_zk_links_enforce_max() FROM anon, authenticated;

DROP TRIGGER IF EXISTS external_warehouse_zk_links_max_bi
  ON public.external_warehouse_zk_links;

CREATE TRIGGER external_warehouse_zk_links_max_bi
  BEFORE INSERT ON public.external_warehouse_zk_links
  FOR EACH ROW
  EXECUTE FUNCTION public.external_warehouse_zk_links_enforce_max();

COMMENT ON FUNCTION public.external_warehouse_zk_links_enforce_max() IS
  'Egzekwuje max 10 ZK / site (z advisory lock przeciw race).';

NOTIFY pgrst, 'reload schema';
