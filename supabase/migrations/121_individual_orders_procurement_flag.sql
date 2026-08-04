-- Flagi wewnętrzne zakupów na prośbach indywidualnych (panel dzienny).
-- Handlowiec nie powinien ich zmieniać przez JWT — trigger + mutacja przez service role.

ALTER TABLE individual_orders
  ADD COLUMN IF NOT EXISTS procurement_flag text,
  ADD COLUMN IF NOT EXISTS procurement_flag_note text,
  ADD COLUMN IF NOT EXISTS procurement_flag_updated_at timestamptz,
  ADD COLUMN IF NOT EXISTS procurement_flag_updated_by text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'individual_orders_procurement_flag_check'
  ) THEN
    ALTER TABLE individual_orders
      ADD CONSTRAINT individual_orders_procurement_flag_check
      CHECK (
        procurement_flag IS NULL
        OR procurement_flag IN (
          'pilne',
          'czeka_na_klienta',
          'do_wyjasnienia',
          'wstrzymane'
        )
      );
  END IF;
END $$;

COMMENT ON COLUMN individual_orders.procurement_flag IS
  'Wewnętrzna flaga zakupów (panel dzienny) — niewidoczna w UI handlowca.';
COMMENT ON COLUMN individual_orders.procurement_flag_note IS
  'Opcjonalny opis flagi zakupów (max 500 w aplikacji).';
COMMENT ON COLUMN individual_orders.procurement_flag_updated_at IS
  'Timestamp ostatniej zmiany flagi zakupów.';
COMMENT ON COLUMN individual_orders.procurement_flag_updated_by IS
  'Email aktora ostatniej zmiany flagi zakupów.';

CREATE INDEX IF NOT EXISTS individual_orders_procurement_flag_idx
  ON individual_orders (procurement_flag)
  WHERE procurement_flag IS NOT NULL;

CREATE OR REPLACE FUNCTION public.guard_individual_orders_procurement_flag()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF auth.uid() IS NOT NULL AND NOT public.is_operations() THEN
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
      -- Service role (admin client): auth.uid() IS NULL — pozwól.
      IF auth.uid() IS NOT NULL AND NOT public.is_operations() THEN
        RAISE EXCEPTION 'Brak uprawnień do zmiany flagi prośby zakupów'
          USING ERRCODE = '42501';
      END IF;
    END IF;
    RETURN NEW;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS guard_individual_orders_procurement_flag ON public.individual_orders;
CREATE TRIGGER guard_individual_orders_procurement_flag
  BEFORE INSERT OR UPDATE ON public.individual_orders
  FOR EACH ROW
  EXECUTE FUNCTION public.guard_individual_orders_procurement_flag();

NOTIFY pgrst, 'reload schema';
