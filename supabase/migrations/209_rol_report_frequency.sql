-- 209_rol_report_frequency.sql
-- Zgłoszenia ROL: częstotliwość raportów i przełącznik „Aktywny ROL” zamiast dat od/do
-- (docs/plans/rol-ivoclar-zgloszenia.md). Raport miesięczny idzie jak dotąd 1. dnia miesiąca;
-- „week” / „2weeks” dokładają raporty za miniony tydzień / dwa tygodnie. FS trafia do jednego
-- raportu klienta — raport miesięczny zbiera tylko FS, których nie było w krótszych.
-- Kolumny active_from / active_to zostają (historia), aplikacja ich już nie czyta.

ALTER TABLE public.rol_programs
  ADD COLUMN IF NOT EXISTS report_frequency text NOT NULL DEFAULT 'month',
  ADD COLUMN IF NOT EXISTS active boolean;

UPDATE public.rol_programs SET active = (active_to IS NULL OR active_to >= current_date) WHERE active IS NULL;

ALTER TABLE public.rol_programs
  ALTER COLUMN active SET NOT NULL,
  ALTER COLUMN active SET DEFAULT true,
  ALTER COLUMN active_from SET DEFAULT current_date;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'rol_programs_report_frequency') THEN
    ALTER TABLE public.rol_programs
      ADD CONSTRAINT rol_programs_report_frequency CHECK (report_frequency IN ('month', '2weeks', 'week'));
  END IF;
END
$$;

-- Paczka obejmuje okres [period, period_end]: cały miesiąc albo tydzień / dwa tygodnie.
ALTER TABLE public.rol_batches ADD COLUMN IF NOT EXISTS period_end date;
UPDATE public.rol_batches SET period_end = (period + interval '1 month' - interval '1 day')::date WHERE period_end IS NULL;
ALTER TABLE public.rol_batches ALTER COLUMN period_end SET NOT NULL;

ALTER TABLE public.rol_batches DROP CONSTRAINT IF EXISTS rol_batches_period_first_day;
ALTER TABLE public.rol_batches DROP CONSTRAINT IF EXISTS rol_batches_program_period_key;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'rol_batches_period_range') THEN
    ALTER TABLE public.rol_batches ADD CONSTRAINT rol_batches_period_range CHECK (period_end >= period);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'rol_batches_program_range_key') THEN
    ALTER TABLE public.rol_batches
      ADD CONSTRAINT rol_batches_program_range_key UNIQUE (program_id, period, period_end);
  END IF;
END
$$;

-- „Czy ta FS jest już w innym raporcie klienta” — skan pyta o to przy każdym przebiegu.
CREATE INDEX IF NOT EXISTS rol_batch_invoices_fs_idx ON public.rol_batch_invoices (fs_dok_id);
