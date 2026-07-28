-- Lista braków zębowych u dostawców (wariant: linia + kolor + fason).
-- SELECT dla authenticated (ostrzeżenie przy prośbie); zapis tylko panel zębów.

CREATE TABLE IF NOT EXISTS teeth_supplier_shortages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id UUID NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
  manufacturer TEXT NOT NULL,
  product_line TEXT NOT NULL,
  color TEXT NOT NULL,
  mould TEXT NOT NULL DEFAULT '',
  kind TEXT NULL CHECK (kind IS NULL OR kind IN ('anterior', 'posterior')),
  available_from DATE NULL,
  note TEXT NOT NULL DEFAULT '',
  active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_by UUID NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT teeth_supplier_shortages_color_nonempty CHECK (length(btrim(color)) > 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS teeth_supplier_shortages_active_variant_uidx
  ON teeth_supplier_shortages (
    supplier_id,
    product_line,
    lower(btrim(color)),
    lower(btrim(mould)),
    coalesce(kind, '')
  )
  WHERE active;

CREATE INDEX IF NOT EXISTS teeth_supplier_shortages_active_idx
  ON teeth_supplier_shortages (active)
  WHERE active;

CREATE INDEX IF NOT EXISTS teeth_supplier_shortages_supplier_idx
  ON teeth_supplier_shortages (supplier_id);

CREATE INDEX IF NOT EXISTS teeth_supplier_shortages_line_idx
  ON teeth_supplier_shortages (product_line);

ALTER TABLE teeth_supplier_shortages ENABLE ROW LEVEL SECURITY;

CREATE POLICY teeth_supplier_shortages_select ON teeth_supplier_shortages
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY teeth_supplier_shortages_write ON teeth_supplier_shortages
  FOR ALL TO authenticated
  USING (public.can_access_teeth_panel())
  WITH CHECK (public.can_access_teeth_panel());

COMMENT ON TABLE teeth_supplier_shortages IS
  'Braki zębów u labu — wariant (linia/kolor/fason); available_from NULL = data nieustalona.';
