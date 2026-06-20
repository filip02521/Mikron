-- Termin realizacji z dokumentu ZD (Subiekt) — uzupełniany przy wejściu na /moje i nocnym catalog-zd-sync.

ALTER TABLE individual_orders
  ADD COLUMN IF NOT EXISTS zd_fulfillment_deadline DATE NULL,
  ADD COLUMN IF NOT EXISTS zd_fulfillment_source TEXT NULL,
  ADD COLUMN IF NOT EXISTS zd_fulfillment_dok_nr TEXT NULL,
  ADD COLUMN IF NOT EXISTS zd_fulfillment_synced_at TIMESTAMPTZ NULL;

COMMENT ON COLUMN individual_orders.zd_fulfillment_deadline IS
  'Termin realizacji z pola dok_TerminRealizacji / dok_DataRealizacji na dopasowanym ZD.';
COMMENT ON COLUMN individual_orders.zd_fulfillment_source IS
  'Źródło terminu: zd = dokument ZD w Subiekcie.';
COMMENT ON COLUMN individual_orders.zd_fulfillment_dok_nr IS
  'Numer pełny dokumentu ZD (dok_NrPelny).';
COMMENT ON COLUMN individual_orders.zd_fulfillment_synced_at IS
  'Ostatnia synchronizacja terminu z Subiekta (/moje after lub catalog-zd-sync).';

ALTER TABLE individual_orders
  DROP CONSTRAINT IF EXISTS individual_orders_zd_fulfillment_source_check;

ALTER TABLE individual_orders
  ADD CONSTRAINT individual_orders_zd_fulfillment_source_check
  CHECK (zd_fulfillment_source IS NULL OR zd_fulfillment_source = 'zd');

CREATE INDEX IF NOT EXISTS idx_individual_orders_zd_eta_sync
  ON individual_orders (status, zd_fulfillment_synced_at)
  WHERE status IN ('Zamowione', 'Czesciowo_zrealizowane')
    AND request_kind = 'zamowienie';
