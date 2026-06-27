-- Indeksy i polityki RLS dla wyszukiwania produktów z własnej bazy przez handlowców.
-- Używane gdy Subiekt jest offline (typeahead w formularzu prośby).

CREATE INDEX IF NOT EXISTS idx_subiekt_products_symbol_lower
  ON subiekt_products (lower(symbol) text_pattern_ops);

CREATE INDEX IF NOT EXISTS idx_subiekt_products_name_lower
  ON subiekt_products (lower(name) text_pattern_ops);

CREATE INDEX IF NOT EXISTS idx_subiekt_products_plu_lower
  ON subiekt_products (lower(plu) text_pattern_ops);

-- Dla dużych katalogów: GIN trigram. Jeśli pg_trgm jest dostępny, tworzymy;
-- w przeciwnym razie B-tree wystarczy do startu.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_trgm') THEN
    CREATE INDEX IF NOT EXISTS idx_subiekt_products_name_trgm
      ON subiekt_products USING gin (name gin_trgm_ops);
    CREATE INDEX IF NOT EXISTS idx_subiekt_products_symbol_trgm
      ON subiekt_products USING gin (symbol gin_trgm_ops);
  END IF;
END
$$;

-- Odczyt katalogu dla wszystkich zalogowanych użytkowników (handlowcy przy offline Subiekta).
CREATE POLICY IF NOT EXISTS subiekt_products_select_authenticated ON subiekt_products
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY IF NOT EXISTS product_supplier_links_select_authenticated ON product_supplier_links
  FOR SELECT TO authenticated
  USING (true);
