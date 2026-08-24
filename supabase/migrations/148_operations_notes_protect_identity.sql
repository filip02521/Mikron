-- Domknięcie 147: blokada zmiany autora / działu / widoczności (poza adminem).

CREATE OR REPLACE FUNCTION public.operations_notes_protect_identity()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.created_by IS DISTINCT FROM OLD.created_by
     OR NEW.department IS DISTINCT FROM OLD.department
     OR NEW.visibility IS DISTINCT FROM OLD.visibility THEN
    IF NOT public.is_admin() THEN
      RAISE EXCEPTION 'Nie można zmieniać autora, działu ani widoczności notatki.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS operations_notes_protect_identity ON operations_notes;
CREATE TRIGGER operations_notes_protect_identity
  BEFORE UPDATE ON operations_notes
  FOR EACH ROW
  EXECUTE FUNCTION public.operations_notes_protect_identity();

COMMENT ON TABLE operations_notes IS
  'Notatki działu zakupów lub magazynu — prywatne (tylko autor) lub wspólne (cały dział może edytować/archiwizować).';
