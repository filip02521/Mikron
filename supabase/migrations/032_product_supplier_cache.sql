-- Cache: ostatni znany dostawca dla towaru Subiekt (tw_Id).
-- Cel: tańsze i pewniejsze dopasowanie niż pełne skanowanie ZD.

CREATE TABLE IF NOT EXISTS product_supplier_cache (
  subiekt_tw_id INTEGER PRIMARY KEY,
  supplier_id UUID NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
  source TEXT NOT NULL CHECK (source IN ('zd','history')),
  matched_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_product_supplier_cache_supplier
  ON product_supplier_cache (supplier_id);

CREATE INDEX IF NOT EXISTS idx_product_supplier_cache_matched_at
  ON product_supplier_cache (matched_at DESC);

ALTER TABLE product_supplier_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY product_supplier_cache_admin ON product_supplier_cache
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

