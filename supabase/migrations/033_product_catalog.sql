-- Własna baza produktów (Subiekt tw_Id) i mapowań produkt → dostawca.
-- Cel: budować pewne dopasowanie bez skanowania ZD „w locie”.
-- Źródła: historia individual_orders, weryfikacja zakupów, przyszły import z ZD.

-- Porządki po poprzednich eksperymentach (Subiekt ZD lookup + cache).
DROP TABLE IF EXISTS product_supplier_cache;
DROP TABLE IF EXISTS supplier_resolve_log;

ALTER TABLE IF EXISTS individual_orders
  DROP COLUMN IF EXISTS supplier_resolve_pending;

-- Produkt z Subiekta (tw_Id) — klucz główny, bo to „jedyny pewnik”.
CREATE TABLE IF NOT EXISTS subiekt_products (
  subiekt_tw_id INTEGER PRIMARY KEY,
  symbol TEXT NULL,
  name TEXT NULL,
  plu TEXT NULL,
  note TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Powiązanie produktu z dostawcą w aplikacji + metryki użycia.
CREATE TABLE IF NOT EXISTS product_supplier_links (
  subiekt_tw_id INTEGER NOT NULL REFERENCES subiekt_products(subiekt_tw_id) ON DELETE CASCADE,
  supplier_id UUID NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
  order_count INTEGER NOT NULL DEFAULT 0,
  last_action_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_order_id UUID NULL,
  last_source TEXT NOT NULL DEFAULT 'order_history'
    CHECK (last_source IN ('order_history','procurement_verification','zd_import')),
  note TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (subiekt_tw_id, supplier_id)
);

-- Historia zdarzeń (audit + „ostatnia akcja”).
CREATE TABLE IF NOT EXISTS product_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subiekt_tw_id INTEGER NOT NULL REFERENCES subiekt_products(subiekt_tw_id) ON DELETE CASCADE,
  supplier_id UUID NULL REFERENCES suppliers(id) ON DELETE SET NULL,
  order_id UUID NULL,
  source TEXT NOT NULL
    CHECK (source IN ('order_history','procurement_verification','zd_import','admin_note')),
  action TEXT NOT NULL
    CHECK (action IN ('seen','link_upserted','note_updated')),
  detail JSONB NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_subiekt_products_last_seen_at
  ON subiekt_products (last_seen_at DESC);

CREATE INDEX IF NOT EXISTS idx_product_supplier_links_last_action_at
  ON product_supplier_links (last_action_at DESC);

CREATE INDEX IF NOT EXISTS idx_product_supplier_links_supplier
  ON product_supplier_links (supplier_id);

CREATE INDEX IF NOT EXISTS idx_product_events_subiekt_tw_id_created_at
  ON product_events (subiekt_tw_id, created_at DESC);

ALTER TABLE subiekt_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_supplier_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY subiekt_products_admin ON subiekt_products
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY product_supplier_links_admin ON product_supplier_links
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY product_events_admin ON product_events
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

