-- Dział zakupów — Zęby: harmonogram cykliczny dostawców zębów.
-- Osobny system niezależny od supplier_schedules (dzień tygodnia + interwał w tygodniach).

CREATE TABLE IF NOT EXISTS teeth_supplier_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id UUID NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
  -- 1=Poniedziałek, 2=Wtorek, 3=Środa, 4=Czwartek, 5=Piątek
  order_day_of_week SMALLINT NOT NULL CHECK (order_day_of_week BETWEEN 1 AND 5),
  -- Co ile tygodni (1=co tydzień, 2=co 2 tyg., itd.)
  interval_weeks INT NOT NULL DEFAULT 1 CHECK (interval_weeks >= 1 AND interval_weeks <= 12),
  last_order_date DATE NULL,
  shift_date DATE NULL,
  computed_next_date DATE NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (supplier_id)
);

CREATE INDEX IF NOT EXISTS teeth_supplier_schedules_supplier_idx
  ON teeth_supplier_schedules (supplier_id);

ALTER TABLE teeth_supplier_schedules ENABLE ROW LEVEL SECURITY;

CREATE POLICY teeth_supplier_schedules_select ON teeth_supplier_schedules
  FOR SELECT TO authenticated
  USING (public.can_access_teeth_panel());

CREATE POLICY teeth_supplier_schedules_write ON teeth_supplier_schedules
  FOR ALL TO authenticated
  USING (public.can_access_teeth_panel())
  WITH CHECK (public.can_access_teeth_panel());

-- Planowana data dostawy dla zamówień zębowych (ręczna lub wyliczona z historii zębowej).
ALTER TABLE individual_orders
  ADD COLUMN IF NOT EXISTS teeth_delivery_date DATE NULL;

COMMENT ON TABLE teeth_supplier_schedules IS
  'Harmonogram cykliczny dostawców zębów — dzień tygodnia + interwał, niezależny od głównego harmonogramu.';

COMMENT ON COLUMN individual_orders.teeth_delivery_date IS
  'Planowana data dostawy dla zamówień zębowych — ręczna lub wyliczona z historii zębowej.';
