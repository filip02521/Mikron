-- Tablica działu: ogłoszenia zakupów → handlowcy + publiczne pytania/odpowiedzi.
-- MVP: jeden board scope (zakupy ↔ sales). Rozszerzenie magazynu w fazie 3.

CREATE TYPE department_board_kind AS ENUM ('announcement', 'question');

CREATE TYPE department_board_status AS ENUM ('open', 'answered', 'archived');

CREATE TABLE department_board_threads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kind department_board_kind NOT NULL,
  status department_board_status NOT NULL DEFAULT 'open',
  created_by UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  sales_person_id UUID REFERENCES sales_people(id) ON DELETE SET NULL,
  title TEXT NOT NULL CHECK (char_length(trim(title)) >= 1),
  body TEXT NOT NULL DEFAULT '' CHECK (char_length(body) <= 8000),
  color TEXT NOT NULL DEFAULT 'default',
  pinned BOOLEAN NOT NULL DEFAULT false,
  published_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ,
  answered_at TIMESTAMPTZ,
  archived_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT department_board_threads_sales_author_chk CHECK (
    (kind = 'question' AND sales_person_id IS NOT NULL)
    OR (kind = 'announcement' AND sales_person_id IS NULL)
  )
);

CREATE TABLE department_board_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id UUID NOT NULL REFERENCES department_board_threads(id) ON DELETE CASCADE,
  created_by UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  body TEXT NOT NULL CHECK (char_length(trim(body)) >= 1 AND char_length(body) <= 8000),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE department_board_reads (
  thread_id UUID NOT NULL REFERENCES department_board_threads(id) ON DELETE CASCADE,
  profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  read_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (thread_id, profile_id)
);

CREATE INDEX department_board_threads_active_idx
  ON department_board_threads (kind, archived_at, pinned DESC, published_at DESC);

CREATE INDEX department_board_threads_open_questions_idx
  ON department_board_threads (status, created_at DESC)
  WHERE kind = 'question' AND archived_at IS NULL;

CREATE INDEX department_board_posts_thread_idx
  ON department_board_posts (thread_id, created_at ASC);

COMMENT ON TABLE department_board_threads IS
  'Tablica: ogłoszenia zakupów (announcement) lub pytania handlowców (question).';

COMMENT ON TABLE department_board_posts IS
  'Odpowiedzi zakupów (i ewentualnie doprecyzowania) w wątku pytania.';

COMMENT ON TABLE department_board_reads IS
  'Potwierdzenie odczytu ogłoszenia przez profil użytkownika.';

CREATE OR REPLACE FUNCTION public.can_access_department_board()
RETURNS BOOLEAN AS $$
  SELECT public.is_admin()
    OR public.is_operations()
    OR public.is_sales_account();
$$ LANGUAGE sql SECURITY DEFINER STABLE;

ALTER TABLE department_board_threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE department_board_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE department_board_reads ENABLE ROW LEVEL SECURITY;

-- Wątki: odczyt dla handlowców i zakupów
CREATE POLICY department_board_threads_select ON department_board_threads
  FOR SELECT
  USING (
    public.can_access_department_board()
    AND archived_at IS NULL
    AND (expires_at IS NULL OR expires_at > now())
  );

CREATE POLICY department_board_threads_insert ON department_board_threads
  FOR INSERT
  WITH CHECK (
    created_by = auth.uid()
    AND (
      (kind = 'announcement' AND (public.is_operations() OR public.is_admin()))
      OR (
        kind = 'question'
        AND public.is_sales_account()
        AND sales_person_id IS NOT NULL
      )
    )
  );

CREATE POLICY department_board_threads_update ON department_board_threads
  FOR UPDATE
  USING (
    public.is_admin()
    OR (kind = 'announcement' AND (public.is_operations() OR public.is_admin()))
    OR (kind = 'question' AND created_by = auth.uid())
  )
  WITH CHECK (public.can_access_department_board());

CREATE POLICY department_board_threads_admin ON department_board_threads
  FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- Posty: odczyt jak wątki
CREATE POLICY department_board_posts_select ON department_board_posts
  FOR SELECT
  USING (public.can_access_department_board());

CREATE POLICY department_board_posts_insert ON department_board_posts
  FOR INSERT
  WITH CHECK (
    created_by = auth.uid()
    AND (
      public.is_operations()
      OR public.is_admin()
    )
  );

CREATE POLICY department_board_posts_admin ON department_board_posts
  FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- Odczyty: własne
CREATE POLICY department_board_reads_select ON department_board_reads
  FOR SELECT
  USING (profile_id = auth.uid() OR public.is_admin() OR public.is_operations());

CREATE POLICY department_board_reads_insert ON department_board_reads
  FOR INSERT
  WITH CHECK (profile_id = auth.uid() AND public.is_sales_account());

CREATE POLICY department_board_reads_upsert ON department_board_reads
  FOR UPDATE
  USING (profile_id = auth.uid())
  WITH CHECK (profile_id = auth.uid());
