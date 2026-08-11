-- Pary montaż/demontaż: SKU paczki (zakup ZD) ↔ SKU sztuk (sprzedaż).
-- Współdzielone: szacunek ZD, match ZD↔prośba, pair-aware stan.

CREATE TABLE IF NOT EXISTS public.zd_product_pairs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pack_tw_id integer NOT NULL,
  piece_tw_id integer NOT NULL,
  units_per_pack integer NOT NULL,
  source text NOT NULL DEFAULT 'manual',
  subiekt_kpl_id integer NULL,
  pack_symbol text NULL,
  pack_nazwa text NOT NULL DEFAULT '',
  piece_symbol text NULL,
  piece_nazwa text NOT NULL DEFAULT '',
  note text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
  CONSTRAINT zd_product_pairs_pack_tw_positive CHECK (pack_tw_id > 0),
  CONSTRAINT zd_product_pairs_piece_tw_positive CHECK (piece_tw_id > 0),
  CONSTRAINT zd_product_pairs_pack_ne_piece CHECK (pack_tw_id <> piece_tw_id),
  CONSTRAINT zd_product_pairs_units_min CHECK (units_per_pack >= 2),
  CONSTRAINT zd_product_pairs_units_max CHECK (units_per_pack <= 100000),
  CONSTRAINT zd_product_pairs_source_check
    CHECK (source IN ('manual', 'subiekt_komplet')),
  CONSTRAINT zd_product_pairs_note_len CHECK (char_length(note) <= 500),
  CONSTRAINT zd_product_pairs_pack_tw_unique UNIQUE (pack_tw_id),
  CONSTRAINT zd_product_pairs_piece_tw_unique UNIQUE (piece_tw_id)
);

CREATE INDEX IF NOT EXISTS zd_product_pairs_pack_symbol_lower_idx
  ON public.zd_product_pairs (lower(trim(coalesce(pack_symbol, ''))));

CREATE INDEX IF NOT EXISTS zd_product_pairs_piece_symbol_lower_idx
  ON public.zd_product_pairs (lower(trim(coalesce(piece_symbol, ''))));

COMMENT ON TABLE public.zd_product_pairs IS
  'Para komplet: pack_tw_id kupowany na ZD, piece_tw_id sprzedawany na sztuki; units_per_pack = sztuk w 1 paczce.';

ALTER TABLE public.zd_product_pairs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS zd_product_pairs_ops ON public.zd_product_pairs;
CREATE POLICY zd_product_pairs_ops
  ON public.zd_product_pairs
  FOR ALL
  TO authenticated
  USING (public.is_operations())
  WITH CHECK (public.is_operations());

GRANT SELECT, INSERT, UPDATE, DELETE ON public.zd_product_pairs TO authenticated;

-- ratio w momencie powiązania ZD (historia nie rozjeżdża się przy zmianie pary)
ALTER TABLE public.zd_estimate_order_snapshots
  ADD COLUMN IF NOT EXISTS ratio_note text NULL;

ALTER TABLE public.zd_estimate_order_snapshot_lines
  ADD COLUMN IF NOT EXISTS ratio_at_link numeric NULL;

COMMENT ON COLUMN public.zd_estimate_order_snapshot_lines.ratio_at_link IS
  'units_per_pack w momencie linku (gdy linia = pack z pary); qty nadal w sztukach.';

NOTIFY pgrst, 'reload schema';
