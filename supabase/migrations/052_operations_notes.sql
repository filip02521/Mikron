-- Notatnik działów: zakupy i magazyn (prywatne + publiczne w obrębie działu).

CREATE TYPE operations_department AS ENUM ('zakupy', 'magazyn');
CREATE TYPE operations_note_visibility AS ENUM ('private', 'public');

CREATE TABLE operations_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  department operations_department NOT NULL,
  visibility operations_note_visibility NOT NULL DEFAULT 'private',
  created_by UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title TEXT,
  body TEXT NOT NULL DEFAULT '',
  color TEXT NOT NULL DEFAULT 'default',
  pinned BOOLEAN NOT NULL DEFAULT false,
  sort_order INTEGER NOT NULL DEFAULT 0,
  follow_up_at DATE,
  archived_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX operations_notes_dept_active_idx
  ON operations_notes (department, visibility, archived_at, pinned DESC, sort_order ASC);

CREATE INDEX operations_notes_author_idx
  ON operations_notes (created_by, department, archived_at);

CREATE INDEX operations_notes_follow_up_idx
  ON operations_notes (department, follow_up_at)
  WHERE archived_at IS NULL;

COMMENT ON TABLE operations_notes IS
  'Notatki działu zakupów lub magazynu — prywatne (autor) lub publiczne (cały dział).';

CREATE OR REPLACE FUNCTION public.can_access_operations_department(d operations_department)
RETURNS BOOLEAN AS $$
  SELECT public.is_admin()
    OR (d = 'zakupy'::operations_department AND public.is_operations())
    OR (d = 'magazyn'::operations_department AND public.is_magazyn());
$$ LANGUAGE sql SECURITY DEFINER STABLE;

ALTER TABLE operations_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY operations_notes_select ON operations_notes
  FOR SELECT
  USING (
    public.can_access_operations_department(department)
    AND (
      visibility = 'public'::operations_note_visibility
      OR created_by = auth.uid()
      OR public.is_admin()
    )
  );

CREATE POLICY operations_notes_insert ON operations_notes
  FOR INSERT
  WITH CHECK (
    created_by = auth.uid()
    AND public.can_access_operations_department(department)
  );

CREATE POLICY operations_notes_update ON operations_notes
  FOR UPDATE
  USING (created_by = auth.uid() OR public.is_admin())
  WITH CHECK (public.can_access_operations_department(department));

CREATE POLICY operations_notes_delete ON operations_notes
  FOR DELETE
  USING (created_by = auth.uid() OR public.is_admin());

CREATE POLICY operations_notes_admin ON operations_notes
  FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());
