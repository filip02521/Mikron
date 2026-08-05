-- Aktywacja seed flag torów + flaga „Do sprawdzenia” (panel dzienny — swimlanes).

-- Kolizja etykiety: inne wiersze z tą samą nazwą (case-insensitive) → uniknij unique active index / assertLabelAvailable.
UPDATE public.procurement_flag_definitions d
SET
  label = left(btrim(d.label) || ' (stara)', 40),
  updated_at = now()
WHERE lower(btrim(d.label)) = lower('Do sprawdzenia')
  AND d.id <> '11111111-1111-4111-8111-111111111105'::uuid;

UPDATE public.procurement_flag_definitions
SET is_active = true, updated_at = now()
WHERE id IN (
  '11111111-1111-4111-8111-111111111102'::uuid,
  '11111111-1111-4111-8111-111111111103'::uuid,
  '11111111-1111-4111-8111-111111111104'::uuid
)
AND is_active = false;

INSERT INTO public.procurement_flag_definitions (id, label, color, sort_order, is_active)
VALUES (
  '11111111-1111-4111-8111-111111111105'::uuid,
  'Do sprawdzenia',
  'amber',
  1,
  true
)
ON CONFLICT (id) DO UPDATE
SET
  label = EXCLUDED.label,
  color = EXCLUDED.color,
  sort_order = EXCLUDED.sort_order,
  is_active = true,
  updated_at = now();

-- Kosmetyczny porządek sort_order seedów (kolejność torów flag + rank w grupie mieszanej).
UPDATE public.procurement_flag_definitions SET sort_order = 0, updated_at = now()
WHERE id = '11111111-1111-4111-8111-111111111101'::uuid;
UPDATE public.procurement_flag_definitions SET sort_order = 1, updated_at = now()
WHERE id = '11111111-1111-4111-8111-111111111105'::uuid;
UPDATE public.procurement_flag_definitions SET sort_order = 2, updated_at = now()
WHERE id = '11111111-1111-4111-8111-111111111103'::uuid;
UPDATE public.procurement_flag_definitions SET sort_order = 3, updated_at = now()
WHERE id = '11111111-1111-4111-8111-111111111102'::uuid;
UPDATE public.procurement_flag_definitions SET sort_order = 4, updated_at = now()
WHERE id = '11111111-1111-4111-8111-111111111104'::uuid;

NOTIFY pgrst, 'reload schema';
