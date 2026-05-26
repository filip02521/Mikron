-- Prośby z towarem Subiekt — dostawca uzupełniany w tle (bez czekania handlowca).

ALTER TABLE individual_orders
  ADD COLUMN IF NOT EXISTS supplier_resolve_pending BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN individual_orders.supplier_resolve_pending IS
  'true: po zapisie trwa dopasowanie dostawcy z ZD Subiekt; sukces → status Nowe, brak → Weryfikacja';

CREATE INDEX IF NOT EXISTS idx_individual_orders_supplier_resolve_pending
  ON individual_orders (supplier_resolve_pending)
  WHERE supplier_resolve_pending = true;
