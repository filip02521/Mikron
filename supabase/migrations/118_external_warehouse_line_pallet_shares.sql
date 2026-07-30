-- Rozbicie pozycji ZK na kilka palet (udziały qty per etykieta).
-- line_meta.pallet_label pozostaje dla przypisania 1:1; przy shares meta.pallet_label = NULL.

CREATE TABLE IF NOT EXISTS public.external_warehouse_line_pallet_shares (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  zk_link_id UUID NOT NULL REFERENCES public.external_warehouse_zk_links(id) ON DELETE CASCADE,
  line_key TEXT NOT NULL,
  pallet_label TEXT NOT NULL,
  qty NUMERIC NOT NULL,
  updated_by UUID NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT external_warehouse_line_pallet_shares_key_nonempty
    CHECK (length(btrim(line_key)) > 0),
  CONSTRAINT external_warehouse_line_pallet_shares_pallet_nonempty
    CHECK (length(btrim(pallet_label)) > 0),
  CONSTRAINT external_warehouse_line_pallet_shares_pallet_len
    CHECK (char_length(pallet_label) <= 80),
  CONSTRAINT external_warehouse_line_pallet_shares_qty_positive
    CHECK (qty > 0),
  CONSTRAINT external_warehouse_line_pallet_shares_link_key_pallet_uid
    UNIQUE (zk_link_id, line_key, pallet_label)
);

CREATE INDEX IF NOT EXISTS external_warehouse_line_pallet_shares_link_line_idx
  ON public.external_warehouse_line_pallet_shares (zk_link_id, line_key);

CREATE INDEX IF NOT EXISTS external_warehouse_line_pallet_shares_pallet_idx
  ON public.external_warehouse_line_pallet_shares (zk_link_id, pallet_label);

CREATE INDEX IF NOT EXISTS external_warehouse_line_pallet_shares_updated_by_idx
  ON public.external_warehouse_line_pallet_shares (updated_by);

ALTER TABLE public.external_warehouse_line_pallet_shares ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS external_warehouse_line_pallet_shares_all
  ON public.external_warehouse_line_pallet_shares;
CREATE POLICY external_warehouse_line_pallet_shares_all
  ON public.external_warehouse_line_pallet_shares
  FOR ALL TO authenticated
  USING (public.is_operations())
  WITH CHECK (public.is_operations());

GRANT SELECT, INSERT, UPDATE, DELETE
  ON TABLE public.external_warehouse_line_pallet_shares TO authenticated;

-- Nowy kind w dzienniku
ALTER TABLE public.external_warehouse_change_log
  DROP CONSTRAINT IF EXISTS external_warehouse_change_log_kind_check;

ALTER TABLE public.external_warehouse_change_log
  ADD CONSTRAINT external_warehouse_change_log_kind_check CHECK (
    kind IN (
      'zk_linked',
      'zk_unlinked',
      'lines_added',
      'lines_removed',
      'qty_changed',
      'pallet_changed',
      'pallet_renamed',
      'pallet_shares_changed',
      'line_note',
      'site_note'
    )
  );

COMMENT ON TABLE public.external_warehouse_line_pallet_shares IS
  'Udziały ilości pozycji ZK na nazwanych paletach (rozbicie 1 linii → N palet).';

NOTIFY pgrst, 'reload schema';
