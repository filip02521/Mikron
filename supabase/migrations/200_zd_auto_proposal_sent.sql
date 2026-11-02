-- 200_zd_auto_proposal_sent.sql
-- Ostatni etap zamówienia automatu ZD (spec §4.2: accepted → sent): zamówienie poszło do dostawcy.
-- • sent_at — kiedy; ustawia je wysyłka z OnTime (Gmail) albo „Wysłałem ręcznie” w panelu wysyłki ZD.
-- • sent_via — gmail | manual. Panel dzienny pokazuje po tym, które zamówienia automatu są domknięte.
-- Baza bez tej migracji działa dalej: kod czyta kolumny przez to_jsonb, a zapis pomija przy jej braku.

ALTER TABLE public.zd_auto_proposals
  ADD COLUMN IF NOT EXISTS sent_at timestamptz NULL,
  ADD COLUMN IF NOT EXISTS sent_via text NULL;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'zd_auto_proposals_sent_via_check') THEN
    ALTER TABLE public.zd_auto_proposals
      ADD CONSTRAINT zd_auto_proposals_sent_via_check CHECK (sent_via IS NULL OR sent_via IN ('gmail', 'manual'));
  END IF;
END
$$;
