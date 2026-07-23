-- Tablica: swobodne wątki + zamykanie przez handlowca + archiwum pytań.

-- Kto zamknął wątek (handlowiec lub zakupy).
ALTER TABLE department_board_threads
  ADD COLUMN IF NOT EXISTS closed_by UUID REFERENCES profiles(id) ON DELETE SET NULL;

COMMENT ON COLUMN department_board_threads.closed_by IS
  'Profil użytkownika, który zamknął wątek pytania (handlowiec lub zakupy).';

-- Indeks dla zakończonych pytań (archived_at IS NOT NULL).
CREATE INDEX IF NOT EXISTS department_board_threads_closed_questions_idx
  ON department_board_threads (archived_at DESC, created_at DESC)
  WHERE kind = 'question' AND archived_at IS NOT NULL;

-- RLS: pozwól handlowcom odpowiadać w wątkach pytań (nie tylko zakupy/admin).
DROP POLICY IF EXISTS department_board_posts_insert ON department_board_posts;
CREATE POLICY department_board_posts_insert ON department_board_posts
  FOR INSERT
  WITH CHECK (
    created_by = auth.uid()
    AND (
      public.is_operations()
      OR public.is_admin()
      OR public.is_sales_account()
    )
  );

-- RLS: pozwól handlowcom zamykać własne wątki pytań.
DROP POLICY IF EXISTS department_board_threads_update ON department_board_threads;
CREATE POLICY department_board_threads_update ON department_board_threads
  FOR UPDATE
  USING (
    public.is_admin()
    OR (kind = 'announcement' AND (public.is_operations() OR public.is_admin()))
    OR (kind = 'question' AND created_by = auth.uid())
    OR (kind = 'question' AND public.is_operations())
  )
  WITH CHECK (public.can_access_department_board());

-- RLS: pozwól odczyt zarchiwizowanych pytań (ale nie wygasłych ogłoszeń).
DROP POLICY IF EXISTS department_board_threads_select ON department_board_threads;
CREATE POLICY department_board_threads_select ON department_board_threads
  FOR SELECT
  USING (
    public.can_access_department_board()
    AND (
      (kind = 'question')
      OR (kind = 'announcement' AND archived_at IS NULL AND (expires_at IS NULL OR expires_at > now()))
    )
  );
