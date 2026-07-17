-- Numery telefonów przypisane do kurierów w dzienniku dostaw.

CREATE TABLE warehouse_carrier_phones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  carrier_slug TEXT NOT NULL REFERENCES warehouse_carriers(slug) ON DELETE CASCADE,
  label TEXT NOT NULL DEFAULT '',
  phone TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX warehouse_carrier_phones_carrier_idx
  ON warehouse_carrier_phones (carrier_slug, sort_order);

ALTER TABLE warehouse_carrier_phones ENABLE ROW LEVEL SECURITY;

CREATE POLICY warehouse_carrier_phones_select ON warehouse_carrier_phones
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY warehouse_carrier_phones_manage ON warehouse_carrier_phones
  FOR ALL TO authenticated
  USING (public.is_warehouse_staff())
  WITH CHECK (public.is_warehouse_staff());

COMMENT ON TABLE warehouse_carrier_phones IS
  'Numery telefonów przypisane do kurierów — szybki dostęp z dziennika dostaw.';
