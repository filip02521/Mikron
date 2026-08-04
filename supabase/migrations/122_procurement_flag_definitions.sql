-- Własne definicje flag zakupów + przejście individual_orders.procurement_flag na UUID FK.
-- Zachowuje istniejące wartości enum jako nieaktywne definicje (poza Pilne).

CREATE TABLE IF NOT EXISTS public.procurement_flag_definitions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  label text NOT NULL,
  color text NOT NULL
    CHECK (color IN (
      'rose', 'amber', 'sky', 'fuchsia', 'emerald', 'slate', 'violet'
    )),
  sort_order int NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT procurement_flag_definitions_label_len
    CHECK (char_length(btrim(label)) BETWEEN 1 AND 40)
);

CREATE UNIQUE INDEX IF NOT EXISTS procurement_flag_definitions_label_active_uidx
  ON public.procurement_flag_definitions (lower(btrim(label)))
  WHERE is_active;

COMMENT ON TABLE public.procurement_flag_definitions IS
  'Definicje flag zakupów (panel dzienny) — nazwa + kolor; zarządzane przez ops.';

ALTER TABLE public.procurement_flag_definitions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS procurement_flag_definitions_ops ON public.procurement_flag_definitions;
CREATE POLICY procurement_flag_definitions_ops
  ON public.procurement_flag_definitions
  FOR ALL
  TO authenticated
  USING (public.is_operations())
  WITH CHECK (public.is_operations());

GRANT SELECT, INSERT, UPDATE, DELETE ON public.procurement_flag_definitions TO authenticated;

-- Stałe UUID seed (używane też w fixturech TS).
INSERT INTO public.procurement_flag_definitions (id, label, color, sort_order, is_active)
VALUES
  ('11111111-1111-4111-8111-111111111101'::uuid, 'Pilne', 'rose', 0, true),
  ('11111111-1111-4111-8111-111111111102'::uuid, 'Do wyjaśnienia', 'fuchsia', 1, false),
  ('11111111-1111-4111-8111-111111111103'::uuid, 'Czeka na klienta', 'sky', 2, false),
  ('11111111-1111-4111-8111-111111111104'::uuid, 'Wstrzymane', 'slate', 3, false)
ON CONFLICT (id) DO NOTHING;

-- CHECK z 121 blokuje wartości UUID — drop przed mapowaniem.
ALTER TABLE public.individual_orders
  DROP CONSTRAINT IF EXISTS individual_orders_procurement_flag_check;

DROP INDEX IF EXISTS individual_orders_procurement_flag_idx;

-- Mapowanie starych wartości tekstowych → UUID (zanim zmienimy typ kolumny).
UPDATE public.individual_orders
SET procurement_flag = '11111111-1111-4111-8111-111111111101'
WHERE procurement_flag = 'pilne';

UPDATE public.individual_orders
SET procurement_flag = '11111111-1111-4111-8111-111111111102'
WHERE procurement_flag = 'do_wyjasnienia';

UPDATE public.individual_orders
SET procurement_flag = '11111111-1111-4111-8111-111111111103'
WHERE procurement_flag = 'czeka_na_klienta';

UPDATE public.individual_orders
SET procurement_flag = '11111111-1111-4111-8111-111111111104'
WHERE procurement_flag = 'wstrzymane';

-- Nieznane / nie-UUID → NULL (żeby ALTER TYPE uuid nie padł).
UPDATE public.individual_orders
SET procurement_flag = NULL
WHERE procurement_flag IS NOT NULL
  AND procurement_flag !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';

-- UUID wskazujące na nieistniejącą definicję → NULL (przed FK).
UPDATE public.individual_orders io
SET procurement_flag = NULL
WHERE io.procurement_flag IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM public.procurement_flag_definitions d
    WHERE d.id::text = io.procurement_flag
  );

ALTER TABLE public.individual_orders
  ALTER COLUMN procurement_flag TYPE uuid
  USING (
    CASE
      WHEN procurement_flag IS NULL THEN NULL
      ELSE procurement_flag::uuid
    END
  );

ALTER TABLE public.individual_orders
  DROP CONSTRAINT IF EXISTS individual_orders_procurement_flag_fkey;

ALTER TABLE public.individual_orders
  ADD CONSTRAINT individual_orders_procurement_flag_fkey
  FOREIGN KEY (procurement_flag)
  REFERENCES public.procurement_flag_definitions (id)
  ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS individual_orders_procurement_flag_idx
  ON public.individual_orders (procurement_flag)
  WHERE procurement_flag IS NOT NULL;

COMMENT ON COLUMN public.individual_orders.procurement_flag IS
  'FK do procurement_flag_definitions — wewnętrzna flaga zakupów (panel dzienny).';

NOTIFY pgrst, 'reload schema';
