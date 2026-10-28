-- 201_zd_line_decisions.sql
-- Dziennik decyzji per linia przy „Utwórz ZD” w Kreatorze (audyt 28.10.2026): co silnik proponował,
-- co poszło na ZD, także linie zdjęte z listy. Dotąd ślad był tylko w `zd_auto_proposals.final_lines`
-- (jednostki bez wartości, tylko dla zaakceptowanych propozycji) — korekty przy ZD bez propozycji
-- i linie usunięte znikały. Z dziennika: KPI korekty i „pamięć korekt” per towar w silniku.
CREATE TABLE IF NOT EXISTS public.zd_line_decisions (
  id bigserial PRIMARY KEY,
  supplier_id uuid NOT NULL,
  proposal_id uuid NULL,
  dok_id integer NOT NULL,
  dok_nr text NULL,
  subiekt_tw_id integer NOT NULL,
  tw_symbol text NULL,
  tw_nazwa text NULL,
  -- Jednostki dokumentu ZD (paczki w trybie A, sztuki w B) — jak `zd_auto_proposals.lines[].zdUnits`.
  proposed_units numeric NOT NULL,
  final_units numeric NOT NULL,
  -- Powód zmiany z listy w Kreatorze (klient, promocja, cena, rytm, inne); NULL = bez powodu.
  reason text NULL,
  -- Mnożnik pamięci korekt, który już siedział w proposed_units (cel × mnożnik); NULL/1 = silnik bez pamięci.
  -- Wzorzec liczy stosunek do surowej propozycji: final / proposed × pattern_factor — inaczej raz nauczony
  -- mnożnik znikałby, gdy tylko zaczniesz akceptować dopasowaną ilość.
  pattern_factor numeric NULL,
  decided_by uuid NULL,
  decided_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT zd_line_decisions_units_nonneg CHECK (proposed_units >= 0 AND final_units >= 0)
);

CREATE INDEX IF NOT EXISTS zd_line_decisions_supplier_tw_idx
  ON public.zd_line_decisions (supplier_id, subiekt_tw_id, decided_at DESC);
CREATE INDEX IF NOT EXISTS zd_line_decisions_supplier_at_idx
  ON public.zd_line_decisions (supplier_id, decided_at DESC);

ALTER TABLE public.zd_line_decisions DISABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'ontime_app') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON public.zd_line_decisions TO ontime_app;
    GRANT USAGE, SELECT ON SEQUENCE public.zd_line_decisions_id_seq TO ontime_app;
  END IF;
END
$$;
