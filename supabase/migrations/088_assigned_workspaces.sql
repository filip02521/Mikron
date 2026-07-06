-- Przypisane obszary robocze (dostawy, zęby, magazyn) — zastępują podział ról zakupy_zeby/magazyn.

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS assigned_workspaces TEXT[] NOT NULL DEFAULT '{}';

-- Migracja istniejących użytkowników
UPDATE profiles SET assigned_workspaces = ARRAY['dostawy','zeby','magazyn']
  WHERE role = 'admin' AND assigned_workspaces = '{}';
UPDATE profiles SET assigned_workspaces = ARRAY['dostawy','zeby']
  WHERE role = 'zakupy_zeby';
UPDATE profiles SET assigned_workspaces = ARRAY['magazyn']
  WHERE role = 'magazyn';
UPDATE profiles SET assigned_workspaces = ARRAY['dostawy']
  WHERE role = 'zakupy' AND assigned_workspaces = '{}';

-- RLS: sprawdzaj assigned_workspaces zamiast roli
CREATE OR REPLACE FUNCTION public.is_operations()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
      AND (role = 'admin' OR 'dostawy' = ANY(assigned_workspaces))
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION public.is_magazyn()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
      AND (role = 'admin' OR 'magazyn' = ANY(assigned_workspaces))
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION public.can_access_teeth_panel()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
      AND (role = 'admin' OR 'zeby' = ANY(assigned_workspaces))
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE INDEX IF NOT EXISTS profiles_assigned_workspaces_idx
  ON profiles USING GIN (assigned_workspaces);
