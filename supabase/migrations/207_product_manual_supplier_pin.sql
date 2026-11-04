-- 207_product_manual_supplier_pin.sql
-- Ręczne przypisanie dostawcy w /admin/produkty jest ostateczne: produkt zostaje tylko przy wybranym
-- dostawcy, a import ZD / historia zamówień nie dopisują go z powrotem innym dostawcom
-- (np. dwie kartoteki MOTYL-Pro na tym samym kh ciągnęły te same towary z ZD).
ALTER TABLE public.subiekt_products
  ADD COLUMN IF NOT EXISTS manual_supplier_id uuid NULL REFERENCES public.suppliers(id) ON DELETE SET NULL;

-- Przypięcia sprzed migracji: ostatnie ręczne przypisanie z panelu admina, o ile link nadal istnieje.
WITH last_manual AS (
  SELECT DISTINCT ON (e.subiekt_tw_id) e.subiekt_tw_id, e.supplier_id
  FROM public.product_events e
  WHERE e.action = 'link_upserted'
    AND e.supplier_id IS NOT NULL
    AND (e.detail ->> 'manualAdmin') = 'true'
  ORDER BY e.subiekt_tw_id, e.created_at DESC
)
UPDATE public.subiekt_products p
SET manual_supplier_id = m.supplier_id
FROM last_manual m
WHERE p.subiekt_tw_id = m.subiekt_tw_id
  AND p.manual_supplier_id IS NULL
  AND EXISTS (
    SELECT 1 FROM public.product_supplier_links l
    WHERE l.subiekt_tw_id = m.subiekt_tw_id AND l.supplier_id = m.supplier_id
  );

DELETE FROM public.product_supplier_links l
USING public.subiekt_products p
WHERE p.subiekt_tw_id = l.subiekt_tw_id
  AND p.manual_supplier_id IS NOT NULL
  AND l.supplier_id <> p.manual_supplier_id;
