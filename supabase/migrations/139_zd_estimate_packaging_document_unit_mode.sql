-- Tryb dokumentu opakowania ZD:
-- packages = 1 na ZD to opakowanie (ceil need/N paczek)
-- pieces_multiple = Do ZD w sztukach, dobij do wielokrotności N

ALTER TABLE public.zd_estimate_packaging
  ADD COLUMN IF NOT EXISTS document_unit_mode text NOT NULL DEFAULT 'packages';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'zd_estimate_packaging_document_unit_mode_check'
  ) THEN
    ALTER TABLE public.zd_estimate_packaging
      ADD CONSTRAINT zd_estimate_packaging_document_unit_mode_check
      CHECK (document_unit_mode IN ('packages', 'pieces_multiple'));
  END IF;
END $$;

COMMENT ON COLUMN public.zd_estimate_packaging.document_unit_mode IS
  'packages = 1 na ZD to opakowanie; pieces_multiple = Do ZD w sztukach, dobij do wielokrotności N';

NOTIFY pgrst, 'reload schema';
