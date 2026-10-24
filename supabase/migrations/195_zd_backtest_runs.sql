-- 195_zd_backtest_runs.sql
-- Backtest automatu ZD dla jednego dostawcy (ekran /zakupy/automat → Backtest): przebieg w tle,
-- postęp i wynik z werdyktem. Jeden wiersz na uruchomienie; ekran czyta najnowszy na dostawcę.
CREATE TABLE IF NOT EXISTS public.zd_backtest_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id uuid NOT NULL REFERENCES public.suppliers(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'queued',
  -- { targetDays, cycleDays }
  params jsonb NOT NULL,
  -- { phase, done, total }
  progress jsonb NOT NULL DEFAULT '{}'::jsonb,
  -- okres, rzeczywistość, warianty, werdykt, jakość danych (src/lib/data/zd-backtest-run.ts)
  result jsonb NULL,
  error text NULL,
  created_by uuid NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  started_at timestamptz NULL,
  finished_at timestamptz NULL,
  CONSTRAINT zd_backtest_runs_status_check CHECK (status IN ('queued', 'running', 'done', 'error'))
);

CREATE INDEX IF NOT EXISTS zd_backtest_runs_supplier_created_idx
  ON public.zd_backtest_runs (supplier_id, created_at DESC);

ALTER TABLE public.zd_backtest_runs DISABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'ontime_app') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON public.zd_backtest_runs TO ontime_app;
  END IF;
END
$$;
