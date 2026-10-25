-- 193_zd_auto_proposal_services.sql
-- Propozycja ZD automatu:
-- 1) prośby bez towaru na liście zakresu (usługi, wykluczone) — przy akceptacji idą do uwag ZD
--    jak w Kreatorze. Bez tej listy akceptacja nie dopisuje usług.
-- 2) chwila rozpoczęcia tworzenia ZD z propozycji — atomowa blokada (dwie zakładki, kilka
--    instancji) i ślad po timeoucie Subiekta: ZD mogło powstać, więc ta propozycja nie
--    tworzy drugiego; nowe przeliczenie daje nową propozycję.
ALTER TABLE public.zd_auto_proposals
  ADD COLUMN IF NOT EXISTS service_order_ids jsonb NULL,
  ADD COLUMN IF NOT EXISTS create_attempted_at timestamptz NULL;
