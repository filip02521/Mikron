-- ============================================================
-- 150: RLS helpers → schema private (poza PostgREST /rpc)
-- ============================================================
-- Supabase Advisor: authenticated_security_definer_function_executable
-- Funkcje SECURITY DEFINER muszą być dostępne dla roli authenticated
-- (ewaluacja RLS), ale nie powinny być wystawione w public API.
--
-- PostgREST eksponuje tylko schema public — private nie trafia do /rpc/*.
-- Polityki RLS wołają is_admin() bez prefiksu → search_path authenticated.
-- ============================================================

CREATE SCHEMA IF NOT EXISTS private;

REVOKE ALL ON SCHEMA private FROM PUBLIC;
GRANT USAGE ON SCHEMA private TO postgres, service_role, authenticated;

-- Przeniesienie helperów (OID zachowany — zależności RLS zostają)
ALTER FUNCTION public.is_admin() SET SCHEMA private;
ALTER FUNCTION public.my_sales_person_id() SET SCHEMA private;
ALTER FUNCTION public.is_operations() SET SCHEMA private;
ALTER FUNCTION public.is_magazyn() SET SCHEMA private;
ALTER FUNCTION public.is_warehouse_staff() SET SCHEMA private;
ALTER FUNCTION public.is_sales_manager() SET SCHEMA private;
ALTER FUNCTION public.is_sales_account() SET SCHEMA private;
ALTER FUNCTION public.is_sales_rep() SET SCHEMA private;
ALTER FUNCTION public.can_access_teeth_panel() SET SCHEMA private;
ALTER FUNCTION public.can_access_department_board() SET SCHEMA private;
ALTER FUNCTION public.can_access_operations_department(public.operations_department) SET SCHEMA private;
ALTER FUNCTION public.my_managed_group_ids() SET SCHEMA private;
ALTER FUNCTION public.manager_can_access_sales_person(uuid) SET SCHEMA private;
ALTER FUNCTION public.can_read_sales_order(uuid) SET SCHEMA private;
ALTER FUNCTION public.can_insert_sales_order(uuid) SET SCHEMA private;
ALTER FUNCTION public.is_active_delegate_for(uuid) SET SCHEMA private;

-- RLS: authenticated musi mieć EXECUTE; anon i PUBLIC — nie
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA private TO authenticated;
REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA private FROM PUBLIC;
REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA private FROM anon;

-- Polityki i storage używają niekwalifikowanych nazw (is_admin(), …)
ALTER ROLE authenticated SET search_path TO public, private;

-- Triggery z jawnym public.* — aktualizacja do private.*
CREATE OR REPLACE FUNCTION public.operations_notes_protect_identity()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, private
AS $$
BEGIN
  IF NEW.created_by IS DISTINCT FROM OLD.created_by
     OR NEW.department IS DISTINCT FROM OLD.department
     OR NEW.visibility IS DISTINCT FROM OLD.visibility THEN
    IF NOT private.is_admin() THEN
      RAISE EXCEPTION 'Nie można zmieniać autora, działu ani widoczności notatki.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.guard_individual_orders_procurement_flag()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF auth.uid() IS NOT NULL AND NOT private.is_operations() THEN
      NEW.procurement_flag := NULL;
      NEW.procurement_flag_note := NULL;
      NEW.procurement_flag_updated_at := NULL;
      NEW.procurement_flag_updated_by := NULL;
    END IF;
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF NEW.procurement_flag IS DISTINCT FROM OLD.procurement_flag
      OR NEW.procurement_flag_note IS DISTINCT FROM OLD.procurement_flag_note
      OR NEW.procurement_flag_updated_at IS DISTINCT FROM OLD.procurement_flag_updated_at
      OR NEW.procurement_flag_updated_by IS DISTINCT FROM OLD.procurement_flag_updated_by
    THEN
      IF auth.uid() IS NOT NULL AND NOT private.is_operations() THEN
        RAISE EXCEPTION 'Brak uprawnień do zmiany flagi prośby zakupów'
          USING ERRCODE = '42501';
      END IF;
    END IF;
    RETURN NEW;
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.operations_notes_protect_identity() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.operations_notes_protect_identity() FROM anon, authenticated;

REVOKE ALL ON FUNCTION public.guard_individual_orders_procurement_flag() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.guard_individual_orders_procurement_flag() FROM anon, authenticated;

COMMENT ON SCHEMA private IS
  'Helpery RLS (SECURITY DEFINER) — niewystawione w PostgREST; EXECUTE tylko dla authenticated.';

NOTIFY pgrst, 'reload schema';
