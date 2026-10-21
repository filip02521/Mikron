-- 191_stock_watch_bom.sql
-- Braki i zamówienia: składy (BOM) i pary jak w Kreatorze ZD.
-- Zestaw „Składamy” ze stanem 0, który da się złożyć z części na półce, nie jest brakiem
-- do zamówienia — to dokument kompletacji w Subiekcie. Nowy status `to_assemble`
-- („Do kompletacji”) i dane, z czego i ile da się skompletować.

ALTER TABLE public.stock_watch_items
  ADD COLUMN IF NOT EXISTS bom_role text NULL,
  ADD COLUMN IF NOT EXISTS pair_role text NULL,
  -- assemble = złóż zestaw z części; disassemble = rozłóż komplet na składniki.
  ADD COLUMN IF NOT EXISTS assembly_kind text NULL,
  -- assemble: liczba zestawów; disassemble: sztuki składnika z kompletów na stanie.
  ADD COLUMN IF NOT EXISTS assembly_qty numeric NULL,
  ADD COLUMN IF NOT EXISTS assembly_note text NULL;

ALTER TABLE public.stock_watch_items
  DROP CONSTRAINT IF EXISTS stock_watch_items_status_check;
ALTER TABLE public.stock_watch_items
  ADD CONSTRAINT stock_watch_items_status_check
    CHECK (status IN ('out_of_stock', 'critical', 'to_assemble', 'warning', 'ok', 'no_sales'));

ALTER TABLE public.stock_watch_items
  DROP CONSTRAINT IF EXISTS stock_watch_items_bom_role_check;
ALTER TABLE public.stock_watch_items
  ADD CONSTRAINT stock_watch_items_bom_role_check
    CHECK (bom_role IS NULL OR bom_role IN ('assembled_parent', 'purchased_kit', 'component'));

ALTER TABLE public.stock_watch_items
  DROP CONSTRAINT IF EXISTS stock_watch_items_pair_role_check;
ALTER TABLE public.stock_watch_items
  ADD CONSTRAINT stock_watch_items_pair_role_check
    CHECK (pair_role IS NULL OR pair_role IN ('pack', 'piece'));

ALTER TABLE public.stock_watch_items
  DROP CONSTRAINT IF EXISTS stock_watch_items_assembly_check;
ALTER TABLE public.stock_watch_items
  ADD CONSTRAINT stock_watch_items_assembly_check
    CHECK (
      (assembly_kind IS NULL OR assembly_kind IN ('assemble', 'disassemble'))
      AND (assembly_note IS NULL OR char_length(assembly_note) <= 400)
    );
