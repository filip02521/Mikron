-- 187_individual_orders_open_tw_idx.sql
-- Formularz prośby: „już zamówione” — otwarte prośby na ten sam towar (tw_Id).
-- Zapytanie przy każdym wyborze towaru; częściowy indeks trzyma tylko otwarte prośby.
CREATE INDEX IF NOT EXISTS individual_orders_open_tw_idx
  ON public.individual_orders (subiekt_tw_id)
  WHERE subiekt_tw_id IS NOT NULL
    AND status IN ('Nowe', 'Weryfikacja', 'Zamowione', 'Czesciowo_zrealizowane');
