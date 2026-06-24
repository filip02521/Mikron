-- Towary „zęby” — przy prośbie o zamówienie pomijamy kontrolę stanu magazynowego w Subiekcie.

CREATE TABLE prosba_teeth_products (
  subiekt_tw_id INTEGER PRIMARY KEY,
  symbol TEXT NULL,
  name TEXT NOT NULL,
  plu TEXT NULL,
  note TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID NULL REFERENCES profiles(id) ON DELETE SET NULL
);

CREATE INDEX prosba_teeth_products_symbol_lower_idx
  ON prosba_teeth_products (lower(trim(coalesce(symbol, ''))));

CREATE INDEX prosba_teeth_products_name_lower_idx
  ON prosba_teeth_products (lower(trim(name)));

ALTER TABLE prosba_teeth_products ENABLE ROW LEVEL SECURITY;

CREATE POLICY prosba_teeth_products_select ON prosba_teeth_products
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY prosba_teeth_products_admin ON prosba_teeth_products
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

COMMENT ON TABLE prosba_teeth_products IS
  'Towary uznawane za zęby — przy prośbie o zamówienie pomijana jest kontrola stanu magazynowego w Subiekcie.';
