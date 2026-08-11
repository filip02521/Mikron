-- Mapowanie dostawcy OnTime → zakres szacunku ZD (grupa XOR cecha Subiekta).
-- Używane przy „Przygotuj ZD” z panelu dziennego → /zakupy/szacunek.

CREATE TABLE IF NOT EXISTS public.zd_estimate_supplier_scopes (
  supplier_id uuid PRIMARY KEY REFERENCES public.suppliers(id) ON DELETE CASCADE,
  mode text NOT NULL,
  grupa_id integer NULL,
  cecha_id integer NULL,
  label text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
  CONSTRAINT zd_estimate_supplier_scopes_mode_check
    CHECK (mode IN ('grupa', 'cecha')),
  CONSTRAINT zd_estimate_supplier_scopes_xor CHECK (
    (
      mode = 'grupa'
      AND grupa_id IS NOT NULL
      AND grupa_id > 0
      AND cecha_id IS NULL
    )
    OR (
      mode = 'cecha'
      AND cecha_id IS NOT NULL
      AND cecha_id > 0
      AND grupa_id IS NULL
    )
  ),
  CONSTRAINT zd_estimate_supplier_scopes_label_len
    CHECK (char_length(label) <= 200)
);

COMMENT ON TABLE public.zd_estimate_supplier_scopes IS
  'Dostawca OnTime → filtr estimate (grupaId XOR cechaId) dla szybkiego startu z panelu dziennego.';

ALTER TABLE public.zd_estimate_supplier_scopes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS zd_estimate_supplier_scopes_ops ON public.zd_estimate_supplier_scopes;
CREATE POLICY zd_estimate_supplier_scopes_ops
  ON public.zd_estimate_supplier_scopes
  FOR ALL
  TO authenticated
  USING (public.is_operations())
  WITH CHECK (public.is_operations());

GRANT SELECT, INSERT, UPDATE, DELETE ON public.zd_estimate_supplier_scopes TO authenticated;

NOTIFY pgrst, 'reload schema';
