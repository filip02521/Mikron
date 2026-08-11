-- Składy / promocje wewnętrzne (BOM) dla szacunku ZD.
-- Parent nigdy na ZD; sprzedaż/stan dokłada się do komponentów (jednostki karty).

CREATE TABLE IF NOT EXISTS public.zd_product_boms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_tw_id integer NOT NULL,
  label text NOT NULL DEFAULT '',
  stock_as_cover boolean NOT NULL DEFAULT true,
  source text NOT NULL DEFAULT 'manual',
  note text NOT NULL DEFAULT '',
  parent_symbol text NULL,
  parent_nazwa text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
  CONSTRAINT zd_product_boms_parent_tw_positive CHECK (parent_tw_id > 0),
  CONSTRAINT zd_product_boms_parent_tw_unique UNIQUE (parent_tw_id),
  CONSTRAINT zd_product_boms_source_check CHECK (source IN ('manual')),
  CONSTRAINT zd_product_boms_label_len CHECK (char_length(label) <= 200),
  CONSTRAINT zd_product_boms_note_len CHECK (char_length(note) <= 500),
  CONSTRAINT zd_product_boms_parent_nazwa_len CHECK (char_length(parent_nazwa) <= 300)
);

CREATE TABLE IF NOT EXISTS public.zd_product_bom_components (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bom_id uuid NOT NULL REFERENCES public.zd_product_boms(id) ON DELETE CASCADE,
  component_tw_id integer NOT NULL,
  qty_per_parent integer NOT NULL,
  component_symbol text NULL,
  component_nazwa text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT zd_product_bom_components_tw_positive CHECK (component_tw_id > 0),
  CONSTRAINT zd_product_bom_components_qty_min CHECK (qty_per_parent >= 1),
  CONSTRAINT zd_product_bom_components_qty_max CHECK (qty_per_parent <= 100000),
  CONSTRAINT zd_product_bom_components_unique UNIQUE (bom_id, component_tw_id),
  CONSTRAINT zd_product_bom_components_nazwa_len CHECK (char_length(component_nazwa) <= 300)
);

CREATE INDEX IF NOT EXISTS zd_product_bom_components_component_tw_idx
  ON public.zd_product_bom_components (component_tw_id);

CREATE INDEX IF NOT EXISTS zd_product_boms_parent_symbol_lower_idx
  ON public.zd_product_boms (lower(trim(coalesce(parent_symbol, ''))));

COMMENT ON TABLE public.zd_product_boms IS
  'Skład/promocja wewnętrzna: parent_tw_id nie idzie na ZD; komponenty zbierają popyt/cover.';

COMMENT ON COLUMN public.zd_product_boms.stock_as_cover IS
  'Gdy true: stan + otwarteZd parenta doliczane do cover komponentów (× qty_per_parent).';

ALTER TABLE public.zd_product_boms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.zd_product_bom_components ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS zd_product_boms_ops ON public.zd_product_boms;
CREATE POLICY zd_product_boms_ops
  ON public.zd_product_boms
  FOR ALL
  TO authenticated
  USING (public.is_operations())
  WITH CHECK (public.is_operations());

DROP POLICY IF EXISTS zd_product_bom_components_ops ON public.zd_product_bom_components;
CREATE POLICY zd_product_bom_components_ops
  ON public.zd_product_bom_components
  FOR ALL
  TO authenticated
  USING (public.is_operations())
  WITH CHECK (public.is_operations());

GRANT SELECT, INSERT, UPDATE, DELETE ON public.zd_product_boms TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.zd_product_bom_components TO authenticated;

NOTIFY pgrst, 'reload schema';
