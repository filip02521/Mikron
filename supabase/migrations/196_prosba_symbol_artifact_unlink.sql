-- 196_prosba_symbol_artifact_unlink.sql
-- Prośby wpisane ręcznie, którym formularz zapisał pierwszą literę wpisu jako symbol („S” z „Silikon…”).
-- Dopasowanie po symbolu (backfill tw_Id, Kreator, przyjęcie ZD) wiązało je z towarem o tym symbolu,
-- np. „Kieliszek silikonowy S 15ml”. Kod już ignoruje taki symbol (effectiveRequestSymbol); tu sprzątamy
-- prośby w toku, żeby zostały prośbami „bez towaru” do uzupełnienia, a nie złym towarem.
--
-- Warunek „artefaktu”: symbol to sam początek pierwszego słowa nazwy prośby (po nim litera albo cyfra,
-- nie spacja). Prawdziwy symbol przed nazwą („ABC opis”) i wybór z Subiekta tego nie spełniają.

-- 1) Przypięty towar pochodzi z artefaktu: towar ma dokładnie ten symbol, a nazwa prośby nie jest jego nazwą.
UPDATE public.individual_orders o
   SET symbol = '-',
       subiekt_tw_id = NULL
  FROM public.subiekt_products p
 WHERE p.subiekt_tw_id = o.subiekt_tw_id
   AND o.status IN ('Weryfikacja', 'Nowe', 'Zamowione')
   AND lower(btrim(p.symbol)) = lower(btrim(o.symbol))
   AND length(btrim(o.products)) > length(btrim(o.symbol))
   AND starts_with(lower(btrim(o.products)), lower(btrim(o.symbol)))
   AND substr(btrim(o.products), length(btrim(o.symbol)) + 1, 1) ~ '[[:alnum:]]'
   AND lower(btrim(o.products)) <> lower(btrim(p.name));

-- 2) Bez towaru, ale z artefaktem w symbolu — sam symbol na „-”.
UPDATE public.individual_orders o
   SET symbol = '-'
 WHERE o.subiekt_tw_id IS NULL
   AND o.status IN ('Weryfikacja', 'Nowe', 'Zamowione')
   AND btrim(coalesce(o.symbol, '')) NOT IN ('', '-')
   AND length(btrim(o.products)) > length(btrim(o.symbol))
   AND starts_with(lower(btrim(o.products)), lower(btrim(o.symbol)))
   AND substr(btrim(o.products), length(btrim(o.symbol)) + 1, 1) ~ '[[:alnum:]]';
