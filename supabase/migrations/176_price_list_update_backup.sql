-- 176_price_list_update_backup.sql
-- Cenniki: ponowne wgranie tego samego cennika (cecha + Subiekt + „ważny od”) aktualizuje wpis zamiast dodawać nowy;
-- backup_* = ceny w Subiekcie sprzed pierwszego wgrania (nie nadpisywane przy kolejnych wgraniach).

ALTER TABLE public.price_list_imports
  ADD COLUMN IF NOT EXISTS updated_at timestamptz,
  ADD COLUMN IF NOT EXISTS upload_count integer NOT NULL DEFAULT 1;

ALTER TABLE public.price_list_items
  ADD COLUMN IF NOT EXISTS backup_purchase numeric(14, 4),
  ADD COLUMN IF NOT EXISTS backup_retail numeric(14, 4),
  ADD COLUMN IF NOT EXISTS backup_at timestamptz;

-- Dotychczasowe wpisy: old_* to ceny z podglądu, czyli sprzed zapisu.
UPDATE public.price_list_items i
SET backup_purchase = i.old_purchase, backup_retail = i.old_retail, backup_at = p.created_at
FROM public.price_list_imports p
WHERE p.id = i.import_id AND i.backup_at IS NULL AND i.status <> 'not_in_list';

CREATE INDEX IF NOT EXISTS price_list_imports_identity_idx
  ON public.price_list_imports (cecha_id, host_kind, valid_from, created_at DESC);

COMMENT ON COLUMN public.price_list_items.backup_purchase IS
  'Kartotekowa w Subiekcie przy pierwszym wgraniu cennika — kopia do odtworzenia, nie zmienia się przy ponownym wgraniu.';

-- Przywracanie kopii z poziomu OnTime: restored = ceny z kopii zapisane i odczytane z powrotem,
-- restore_failed = nie przywrócono (błąd, ktoś zmienił cenę po zapisie albo odczyt ≠ kopia).
ALTER TABLE public.price_list_items DROP CONSTRAINT IF EXISTS price_list_items_status_check;
ALTER TABLE public.price_list_items ADD CONSTRAINT price_list_items_status_check
  CHECK (status IN ('not_in_list', 'pending', 'applied', 'changed', 'failed', 'mismatch', 'restored', 'restore_failed'));

-- Ślad przywrócenia osobno od zapisu z cennika (applied_* = kto zapisał cennik, restored_* = kto cofnął).
ALTER TABLE public.price_list_items
  ADD COLUMN IF NOT EXISTS restored_at timestamptz,
  ADD COLUMN IF NOT EXISTS restored_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL;
