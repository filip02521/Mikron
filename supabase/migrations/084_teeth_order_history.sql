-- Dziennik operacji toru zębów (analog normal_order_history dla panelu /zeby).

CREATE TABLE teeth_order_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  action_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  actor_id TEXT,
  actor_email TEXT,
  supplier_id UUID REFERENCES suppliers(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  order_ids UUID[] NOT NULL DEFAULT '{}',
  meta JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX idx_teeth_order_history_action_at ON teeth_order_history (action_at DESC);
CREATE INDEX idx_teeth_order_history_supplier ON teeth_order_history (supplier_id);

ALTER TABLE teeth_order_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY teeth_history_read ON teeth_order_history
  FOR SELECT
  USING (public.can_access_teeth_panel());

CREATE POLICY teeth_history_insert ON teeth_order_history
  FOR INSERT
  WITH CHECK (public.can_access_teeth_panel());

CREATE POLICY admin_all_teeth_history ON teeth_order_history
  FOR ALL
  USING (public.is_admin());
