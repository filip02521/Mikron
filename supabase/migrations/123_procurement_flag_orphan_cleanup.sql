-- Bezpieczne NULL dla orphan UUID (FK już istnieje po 122).
-- Idempotent: czyści flagi wskazujące na nieistniejące definicje.

UPDATE public.individual_orders io
SET procurement_flag = NULL
WHERE io.procurement_flag IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM public.procurement_flag_definitions d
    WHERE d.id = io.procurement_flag
  );

NOTIFY pgrst, 'reload schema';
