-- 190_zd_supplier_order_policy.sql
-- Strategia zamawiania per dostawca (test: Polkard) i propozycje ZD automatu do akceptacji.
-- Brak wiersza = strategia „classic” (jak dotąd) i bez propozycji.
CREATE TABLE IF NOT EXISTS public.zd_supplier_order_policy (
  supplier_id uuid PRIMARY KEY REFERENCES public.suppliers(id) ON DELETE CASCADE,
  strategy text NOT NULL DEFAULT 'classic',
  -- Dni zapasu w celu; NULL = dni zapasu dostawcy.
  target_days integer NULL,
  -- Co ile dni propozycja ZD; NULL = bez propozycji.
  cycle_days integer NULL,
  auto_proposals boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid NULL,
  CONSTRAINT zd_supplier_order_policy_strategy_check CHECK (strategy IN ('classic', 'max30_90')),
  CONSTRAINT zd_supplier_order_policy_target_days_check CHECK (target_days IS NULL OR target_days BETWEEN 1 AND 180),
  CONSTRAINT zd_supplier_order_policy_cycle_days_check CHECK (cycle_days IS NULL OR cycle_days BETWEEN 1 AND 60)
);

-- Propozycja = lista „Do ZD” policzona przez automat w danym dniu; decyzja Filipa i wynik.
CREATE TABLE IF NOT EXISTS public.zd_auto_proposals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id uuid NOT NULL REFERENCES public.suppliers(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  -- Strategia i okno, z którymi liczono (do odtworzenia i porównań).
  policy jsonb NOT NULL,
  data_od date NOT NULL,
  data_do date NOT NULL,
  -- [{ twId, symbol, nazwa, zdUnits, pieces, unitLabel, priceNet, reason }]
  lines jsonb NOT NULL DEFAULT '[]'::jsonb,
  line_count integer NOT NULL DEFAULT 0,
  value_net numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pending',
  decided_at timestamptz NULL,
  decided_by uuid NULL,
  decision_note text NULL,
  -- ZD utworzone z propozycji i jego linie (twId → jednostki ZD) do raportu różnic.
  dok_id integer NULL,
  final_lines jsonb NULL,
  CONSTRAINT zd_auto_proposals_status_check CHECK (status IN ('pending', 'accepted', 'rejected', 'expired'))
);

CREATE INDEX IF NOT EXISTS zd_auto_proposals_supplier_created_idx
  ON public.zd_auto_proposals (supplier_id, created_at DESC);

ALTER TABLE public.zd_supplier_order_policy DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.zd_auto_proposals DISABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'ontime_app') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON public.zd_supplier_order_policy, public.zd_auto_proposals TO ontime_app;
  END IF;
END
$$;
