-- Zsynchronizuj RLS panelu zębów z modelem funkcji (tylko admin + zakupy_zeby).
CREATE OR REPLACE FUNCTION public.can_access_teeth_panel()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid() AND role IN ('admin', 'zakupy_zeby')
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;
