-- 193_zd_auto_proposal_services.sql
-- Propozycja ZD automatu: prośby bez towaru na liście zakresu (usługi, wykluczone) — przy
-- akceptacji idą do uwag ZD jak w Kreatorze. Bez tej listy akceptacja nie dopisuje usług.
ALTER TABLE public.zd_auto_proposals
  ADD COLUMN IF NOT EXISTS service_order_ids jsonb NULL;
