-- Dziennik fizycznych dostaw na rampę + uprawnienia magazynu (po 036_magazyn_role_enum).

CREATE OR REPLACE FUNCTION public.is_magazyn()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid() AND role = 'magazyn'
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION public.is_warehouse_staff()
RETURNS BOOLEAN AS $$
  SELECT public.is_operations() OR public.is_magazyn();
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE TYPE warehouse_carrier AS ENUM (
  'inpost',
  'dhl',
  'dpd',
  'gls',
  'fedex',
  'poczta',
  'kurier_dostawcy',
  'odbior_wlasny',
  'inne'
);

CREATE TYPE warehouse_shipment_form AS ENUM (
  'paczki',
  'palety',
  'paczki_i_palety'
);

CREATE TABLE warehouse_delivery_receipts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  received_date DATE NOT NULL,
  supplier_id UUID NULL REFERENCES suppliers(id) ON DELETE SET NULL,
  supplier_label TEXT NOT NULL DEFAULT '',
  carrier warehouse_carrier NOT NULL,
  shipment_form warehouse_shipment_form NOT NULL DEFAULT 'paczki',
  package_count INTEGER NOT NULL DEFAULT 0 CHECK (package_count >= 0),
  pallet_count INTEGER NOT NULL DEFAULT 0 CHECK (pallet_count >= 0),
  note TEXT NOT NULL DEFAULT '',
  created_by UUID NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
  updated_by UUID NULL REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT warehouse_delivery_receipts_qty_check CHECK (package_count > 0 OR pallet_count > 0)
);

CREATE INDEX idx_warehouse_delivery_receipts_date
  ON warehouse_delivery_receipts (received_date DESC, created_at DESC);

CREATE INDEX idx_warehouse_delivery_receipts_supplier
  ON warehouse_delivery_receipts (supplier_id, received_date DESC);

CREATE TABLE warehouse_carrier_hints (
  supplier_id UUID NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
  carrier warehouse_carrier NOT NULL,
  shipment_form warehouse_shipment_form NOT NULL,
  typical_package_count INTEGER NOT NULL DEFAULT 1 CHECK (typical_package_count >= 0),
  typical_pallet_count INTEGER NOT NULL DEFAULT 0 CHECK (typical_pallet_count >= 0),
  use_count INTEGER NOT NULL DEFAULT 1 CHECK (use_count > 0),
  last_used_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (supplier_id, carrier, shipment_form)
);

ALTER TABLE warehouse_delivery_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE warehouse_carrier_hints ENABLE ROW LEVEL SECURITY;

CREATE POLICY warehouse_delivery_receipts_staff ON warehouse_delivery_receipts
  FOR ALL TO authenticated
  USING (public.is_warehouse_staff())
  WITH CHECK (public.is_warehouse_staff());

CREATE POLICY warehouse_carrier_hints_staff ON warehouse_carrier_hints
  FOR ALL TO authenticated
  USING (public.is_warehouse_staff())
  WITH CHECK (public.is_warehouse_staff());

CREATE POLICY magazyn_individual_orders ON individual_orders
  FOR ALL TO authenticated
  USING (public.is_magazyn())
  WITH CHECK (public.is_magazyn());

CREATE POLICY magazyn_read_suppliers ON suppliers
  FOR SELECT TO authenticated
  USING (public.is_magazyn());

CREATE POLICY magazyn_read_sales ON sales_people
  FOR SELECT TO authenticated
  USING (public.is_magazyn());
