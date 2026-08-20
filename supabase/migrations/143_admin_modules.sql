-- Moduły panelu administracji: przypisania modułów feature do użytkowników
-- MVP: tylko moduł Centrum maili (Ivoclar weekly reports)

CREATE TABLE IF NOT EXISTS user_admin_modules (
  user_id UUID NOT NULL REFERENCES profiles (id) ON DELETE CASCADE,
  module_slug TEXT NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, module_slug)
);

ALTER TABLE user_admin_modules ENABLE ROW LEVEL SECURITY;

-- Każdy user widzi tylko własne przypisania modułów.
CREATE POLICY user_admin_modules_select_own ON user_admin_modules
  FOR SELECT USING (user_id = auth.uid());

-- Administracja może zarządzać przypisaniami (service role zwykle i tak omija RLS,
-- ale policy trzymamy dla spójności/obrony-in-depth).
CREATE POLICY user_admin_modules_admin_manage ON user_admin_modules
  FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE INDEX IF NOT EXISTS idx_user_admin_modules_enabled
  ON user_admin_modules (enabled);

COMMENT ON TABLE user_admin_modules IS 'Przypisania modułów do użytkowników (feature flags dla panelu admina).';

