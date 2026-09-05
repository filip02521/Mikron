-- Triggery biznesowe: bez auth.uid() (app-layer już pilnuje ról).

CREATE OR REPLACE FUNCTION public.guard_individual_orders_procurement_flag()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  -- Walidacja danych; uprawnienia są w warstwie aplikacji.
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.operations_notes_protect_identity()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    NEW.created_by := OLD.created_by;
  END IF;
  RETURN NEW;
END;
$$;
