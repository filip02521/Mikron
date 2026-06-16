-- Katalog kurierów dziennika dostaw — edycja z poziomu UI (bez migracji enum).

CREATE TABLE warehouse_carriers (
  slug TEXT PRIMARY KEY,
  label TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX warehouse_carriers_label_lower_idx
  ON warehouse_carriers (lower(trim(label)));

INSERT INTO warehouse_carriers (slug, label, sort_order) VALUES
  ('dpd', 'DPD', 10),
  ('dhl', 'DHL', 20),
  ('dhl_express', 'DHL Express', 30),
  ('ups', 'UPS', 40),
  ('inpost', 'InPost', 50),
  ('fedex', 'FedEx', 60),
  ('gls', 'GLS', 70),
  ('rhenus_naxco', 'Rhenus / Naxco', 80),
  ('raben', 'Raben', 90),
  ('poczta', 'Poczta Polska', 100),
  ('psd', 'PSD', 110),
  ('tnt', 'TNT', 120),
  ('poltraf', 'POLTRAF', 130),
  ('kuehne_nagel', 'Kuehne + Nagel', 140),
  ('suus_logistics', 'SUUS Logistics', 150),
  ('dachser', 'Dachser', 160),
  ('db_schenker', 'DB Schenker', 170),
  ('mikran_bartek', 'Mikran Bartek', 180),
  ('geis', 'Geis', 190),
  ('jasfbg', 'JASFBG', 200),
  ('hellmann', 'Hellmann', 210),
  ('kurier_dostawcy', 'Kurier dostawcy', 220),
  ('odbior_wlasny', 'Odbiór własny', 230),
  ('inne', 'Inne', 240);

-- Enum → TEXT + FK (historyczne wpisy zachowują slug).

ALTER TABLE warehouse_delivery_receipts
  ALTER COLUMN carrier TYPE TEXT USING carrier::text;

ALTER TABLE warehouse_carrier_hints
  ALTER COLUMN carrier TYPE TEXT USING carrier::text;

ALTER TABLE suppliers
  ALTER COLUMN default_delivery_carrier TYPE TEXT USING default_delivery_carrier::text;

ALTER TABLE warehouse_delivery_receipts
  ADD CONSTRAINT warehouse_delivery_receipts_carrier_fkey
  FOREIGN KEY (carrier) REFERENCES warehouse_carriers(slug);

ALTER TABLE warehouse_carrier_hints
  ADD CONSTRAINT warehouse_carrier_hints_carrier_fkey
  FOREIGN KEY (carrier) REFERENCES warehouse_carriers(slug);

ALTER TABLE suppliers
  ADD CONSTRAINT suppliers_default_delivery_carrier_fkey
  FOREIGN KEY (default_delivery_carrier) REFERENCES warehouse_carriers(slug);

DROP TYPE warehouse_carrier;

ALTER TABLE warehouse_carriers ENABLE ROW LEVEL SECURITY;

CREATE POLICY warehouse_carriers_select ON warehouse_carriers
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY warehouse_carriers_manage ON warehouse_carriers
  FOR ALL TO authenticated
  USING (public.is_warehouse_staff())
  WITH CHECK (public.is_warehouse_staff());

COMMENT ON TABLE warehouse_carriers IS
  'Katalog kurierów w dzienniku dostaw magazynu — edytowalny z UI /kolejka.';
