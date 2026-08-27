-- Preset: komplet zamawiany ze sprzedaży składników (rollup max).

ALTER TABLE public.zd_product_boms
  DROP CONSTRAINT IF EXISTS zd_product_boms_purchase_target_check;
ALTER TABLE public.zd_product_boms
  ADD CONSTRAINT zd_product_boms_purchase_target_check
    CHECK (purchase_target IN ('components', 'as_sold', 'kit_only', 'kit_from_components'));

ALTER TABLE public.zd_product_boms
  DROP CONSTRAINT IF EXISTS zd_product_boms_policy_pair_check;
ALTER TABLE public.zd_product_boms
  ADD CONSTRAINT zd_product_boms_policy_pair_check
    CHECK (
      (demand_allocation = 'explode' AND purchase_target = 'components')
      OR (
        demand_allocation = 'separate'
        AND purchase_target IN ('as_sold', 'kit_only', 'kit_from_components')
      )
    );

COMMENT ON TABLE public.zd_product_boms IS
  'Komplet/skład: purchase_target — components (poza ZD); as_sold (K+części); kit_only (tylko K z własnej sprzedaży); kit_from_components (tylko K ze sprzedaży składników).';

COMMENT ON COLUMN public.zd_product_boms.purchase_target IS
  'components = tylko składniki; as_sold = K i części; kit_only = tylko K (sprzedaż K); kit_from_components = tylko K (rollup max ze składników).';

NOTIFY pgrst, 'reload schema';
