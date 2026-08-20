-- Sesje UI kreatora ZD (/zakupy/szacunek) snapshotowe na potrzeby odtwarzania stanu.
-- Zapisujemy ciężki payload „po Policz” (jsonb), a timer liczony jest po stronie klienta.
-- DB trzyma tylko metadane i snapshot; sprzątanie realizowane przez delete klienta + expires_at do ewentualnego housekeeping.

CREATE TABLE IF NOT EXISTS public.zd_estimate_ui_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'active',
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '1 hour'),
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  schema_version integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT zd_estimate_ui_sessions_status_check
    CHECK (status IN ('active', 'expired'))
);

-- Gwarantujemy: max 1 aktywna sesja na użytkownika.
CREATE UNIQUE INDEX IF NOT EXISTS zd_estimate_ui_sessions_active_unique
  ON public.zd_estimate_ui_sessions(owner_user_id)
  WHERE status = 'active';

CREATE INDEX IF NOT EXISTS zd_estimate_ui_sessions_owner_expires_idx
  ON public.zd_estimate_ui_sessions(owner_user_id, expires_at DESC);

ALTER TABLE public.zd_estimate_ui_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS zd_estimate_ui_sessions_owner_all ON public.zd_estimate_ui_sessions;
CREATE POLICY zd_estimate_ui_sessions_owner_all
  ON public.zd_estimate_ui_sessions
  FOR ALL
  TO authenticated
  USING (owner_user_id = auth.uid())
  WITH CHECK (owner_user_id = auth.uid());

GRANT SELECT, INSERT, UPDATE, DELETE ON public.zd_estimate_ui_sessions
  TO authenticated;

COMMENT ON TABLE public.zd_estimate_ui_sessions IS
  'Snapshoty stanu UI kreatora ZD zapamiętywane po „Policz” do wznowienia po nawigacji.';

NOTIFY pgrst, 'reload schema';

