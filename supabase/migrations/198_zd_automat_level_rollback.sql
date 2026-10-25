-- 198_zd_automat_level_rollback.sql
-- Automat ZD: automatyczne cofnięcie stopnia po brakach klasy A (spec §4.4 — „Cofnięcie stopnia jest automatyczne
-- po brakach (OOS) w klasie A”). Tygodniowe KPI obniża stopień o jeden (najniżej do 1) i zapisuje, kiedy i dlaczego —
-- karta dostawcy, pulpit i panel dzienny pokazują to do następnej ręcznej zmiany ustawień.

ALTER TABLE public.zd_supplier_order_policy
  ADD COLUMN IF NOT EXISTS auto_level_changed_at timestamptz NULL,
  ADD COLUMN IF NOT EXISTS auto_level_change_reason text NULL;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'zd_supplier_order_policy_auto_level_reason_len') THEN
    ALTER TABLE public.zd_supplier_order_policy
      ADD CONSTRAINT zd_supplier_order_policy_auto_level_reason_len
      CHECK (auto_level_change_reason IS NULL OR char_length(auto_level_change_reason) <= 300);
  END IF;
END
$$;
