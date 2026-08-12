-- Presety kompletów/BOM: alokacja popytu + cel zakupu (v1).
-- Default = dotychczasowe zachowanie (explode + components).

ALTER TABLE public.zd_product_boms
  ADD COLUMN IF NOT EXISTS demand_allocation text NOT NULL DEFAULT 'explode',
  ADD COLUMN IF NOT EXISTS purchase_target text NOT NULL DEFAULT 'components';

ALTER TABLE public.zd_product_boms
  DROP CONSTRAINT IF EXISTS zd_product_boms_demand_allocation_check;
ALTER TABLE public.zd_product_boms
  ADD CONSTRAINT zd_product_boms_demand_allocation_check
    CHECK (demand_allocation IN ('explode', 'separate'));

ALTER TABLE public.zd_product_boms
  DROP CONSTRAINT IF EXISTS zd_product_boms_purchase_target_check;
ALTER TABLE public.zd_product_boms
  ADD CONSTRAINT zd_product_boms_purchase_target_check
    CHECK (purchase_target IN ('components', 'as_sold', 'kit_only'));

ALTER TABLE public.zd_product_boms
  DROP CONSTRAINT IF EXISTS zd_product_boms_policy_pair_check;
ALTER TABLE public.zd_product_boms
  ADD CONSTRAINT zd_product_boms_policy_pair_check
    CHECK (
      (demand_allocation = 'explode' AND purchase_target = 'components')
      OR (demand_allocation = 'separate' AND purchase_target IN ('as_sold', 'kit_only'))
    );

COMMENT ON TABLE public.zd_product_boms IS
  'Komplet/skład: parent_tw_id na ZD zależy od purchase_target (components = poza ZD; as_sold/kit_only = kupowany zestaw).';

COMMENT ON COLUMN public.zd_product_boms.demand_allocation IS
  'explode = sprzedaż K doliczana do składników; separate = każdy SKU osobno.';

COMMENT ON COLUMN public.zd_product_boms.purchase_target IS
  'components = tylko składniki; as_sold = K i części; kit_only = tylko K.';

COMMENT ON COLUMN public.zd_product_boms.stock_as_cover IS
  'Sensowne przy explode: stan + otwarteZd parenta doliczane do cover składników (× qty_per_parent). Przy separate powinno być false.';

NOTIFY pgrst, 'reload schema';
