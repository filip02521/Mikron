-- 199_zd_auto_proposal_lifecycle.sql
-- Cykl życia propozycji automatu ZD (audyt 10.2026):
-- • origin — skąd propozycja: nocny przebieg (night), „Przygotuj teraz” w Kreatorze (manual), przeliczenie
--   w panelu „Sprawdź i zatwierdź” (review). Termin kolejnej propozycji liczy się od nocnych i zatwierdzonych —
--   samo obejrzenie panelu nie przesuwa harmonogramu. NULL = propozycja sprzed tej migracji.
-- • original_lines — linie z chwili powstania (lista automatu), zanim panel przeliczył je na aktualnych stanach;
--   KPI korekty człowieka porównuje ZD z tą listą, nie z przeliczeniem.
-- • refreshed_at — ostatnie przeliczenie w panelu (ta sama propozycja, nowe linie).
-- • create_outcome_note — wynik uzgodnienia po niepotwierdzonym tworzeniu ZD (timeout Subiekta).

ALTER TABLE public.zd_auto_proposals
  ADD COLUMN IF NOT EXISTS origin text NULL,
  ADD COLUMN IF NOT EXISTS original_lines jsonb NULL,
  ADD COLUMN IF NOT EXISTS refreshed_at timestamptz NULL,
  ADD COLUMN IF NOT EXISTS create_outcome_note text NULL;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'zd_auto_proposals_origin_check') THEN
    ALTER TABLE public.zd_auto_proposals
      ADD CONSTRAINT zd_auto_proposals_origin_check CHECK (origin IS NULL OR origin IN ('night', 'manual', 'review'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'zd_auto_proposals_create_outcome_note_len') THEN
    ALTER TABLE public.zd_auto_proposals
      ADD CONSTRAINT zd_auto_proposals_create_outcome_note_len
      CHECK (create_outcome_note IS NULL OR char_length(create_outcome_note) <= 500);
  END IF;
END
$$;

-- Uzgodnienie: propozycje z rozpoczętym, niepotwierdzonym tworzeniem ZD.
CREATE INDEX IF NOT EXISTS zd_auto_proposals_create_attempted_idx
  ON public.zd_auto_proposals (create_attempted_at)
  WHERE create_attempted_at IS NOT NULL AND status IN ('pending', 'deferred');
