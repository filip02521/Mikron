-- ============================================================
-- 117: Domknięcie alertów Supabase Advisors po Gądki / teeth
-- ============================================================
-- 1. search_path na triggerze limitu ZK (function_search_path_mutable)
-- 2. Indeksy brakujących FK (unindexed_foreign_keys) — Gądki + shortages
-- 3. teeth_supplier_shortages: rozdziel FOR ALL → INSERT/UPDATE/DELETE
--    (multiple_permissive_policies na SELECT)
-- 4. teeth-ocr-images: bucket private + SELECT tylko panel zębów
--    (public_bucket_allows_listing)
-- ============================================================

-- 1. Trigger max ZK — jawny search_path + brak EXECUTE dla klientów API
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

COMMENT ON FUNCTION public.external_warehouse_zk_links_enforce_max() IS
  'Egzekwuje max 10 ZK / site (advisory lock + search_path=public).';

-- 2. Indeksy FK
CREATE INDEX IF NOT EXISTS external_warehouse_change_log_actor_user_id_idx
  ON public.external_warehouse_change_log (actor_user_id);

CREATE INDEX IF NOT EXISTS external_warehouse_change_log_zk_link_id_idx
  ON public.external_warehouse_change_log (zk_link_id);

CREATE INDEX IF NOT EXISTS external_warehouse_line_meta_updated_by_idx
  ON public.external_warehouse_line_meta (updated_by);

CREATE INDEX IF NOT EXISTS external_warehouse_notes_created_by_idx
  ON public.external_warehouse_notes (created_by);

CREATE INDEX IF NOT EXISTS external_warehouse_notes_zk_link_id_idx
  ON public.external_warehouse_notes (zk_link_id);

CREATE INDEX IF NOT EXISTS teeth_supplier_shortages_created_by_idx
  ON public.teeth_supplier_shortages (created_by);

CREATE INDEX IF NOT EXISTS teeth_supplier_shortages_updated_by_idx
  ON public.teeth_supplier_shortages (updated_by);

-- 3. Braki zębów — SELECT osobno (wszyscy), mutacje osobno (panel zębów)
DROP POLICY IF EXISTS teeth_supplier_shortages_write ON public.teeth_supplier_shortages;

CREATE POLICY teeth_supplier_shortages_insert ON public.teeth_supplier_shortages
  FOR INSERT TO authenticated
  WITH CHECK (public.can_access_teeth_panel());

CREATE POLICY teeth_supplier_shortages_update ON public.teeth_supplier_shortages
  FOR UPDATE TO authenticated
  USING (public.can_access_teeth_panel())
  WITH CHECK (public.can_access_teeth_panel());

CREATE POLICY teeth_supplier_shortages_delete ON public.teeth_supplier_shortages
  FOR DELETE TO authenticated
  USING (public.can_access_teeth_panel());

-- 4. Storage OCR — prywatny bucket; odczyt tylko panel zębów (upload i signed URL = service role)
UPDATE storage.buckets
SET public = false
WHERE id = 'teeth-ocr-images';

DROP POLICY IF EXISTS teeth_ocr_images_read ON storage.objects;
CREATE POLICY teeth_ocr_images_read ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'teeth-ocr-images'
    AND public.can_access_teeth_panel()
  );

DROP POLICY IF EXISTS teeth_ocr_images_write ON storage.objects;
CREATE POLICY teeth_ocr_images_write ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'teeth-ocr-images'
    AND public.can_access_teeth_panel()
  );

NOTIFY pgrst, 'reload schema';
