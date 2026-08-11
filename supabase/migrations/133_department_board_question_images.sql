-- 133_department_board_question_images.sql
-- Zdjęcia dołączane do pytań na Tablicy (handlowiec → zakupy).
-- Pliki w prywatnym buckecie; dostęp wyłącznie przez server actions (service role).

CREATE TABLE IF NOT EXISTS public.department_board_thread_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id uuid NOT NULL REFERENCES public.department_board_threads(id) ON DELETE CASCADE,
  created_by uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  storage_path text NOT NULL,
  file_name text NOT NULL DEFAULT '',
  mime_type text NOT NULL DEFAULT 'image/jpeg',
  byte_size integer,
  sort_order smallint NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT department_board_thread_attachments_path_len
    CHECK (char_length(storage_path) BETWEEN 1 AND 500),
  CONSTRAINT department_board_thread_attachments_name_len
    CHECK (char_length(file_name) <= 200),
  CONSTRAINT department_board_thread_attachments_mime
    CHECK (mime_type IN ('image/jpeg', 'image/png', 'image/webp')),
  CONSTRAINT department_board_thread_attachments_sort
    CHECK (sort_order >= 0 AND sort_order < 20),
  CONSTRAINT department_board_thread_attachments_size
    CHECK (byte_size IS NULL OR (byte_size > 0 AND byte_size <= 5242880)),
  CONSTRAINT department_board_thread_attachments_path_unique
    UNIQUE (storage_path)
);

CREATE INDEX IF NOT EXISTS department_board_thread_attachments_thread_idx
  ON public.department_board_thread_attachments (thread_id, sort_order ASC, created_at ASC);

COMMENT ON TABLE public.department_board_thread_attachments IS
  'Zdjęcia dołączone do wątku pytania na Tablicy (ścieżka w Storage).';

ALTER TABLE public.department_board_thread_attachments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS department_board_thread_attachments_select
  ON public.department_board_thread_attachments;
CREATE POLICY department_board_thread_attachments_select
  ON public.department_board_thread_attachments
  FOR SELECT
  USING (public.can_access_department_board());

-- Mutacje idą przez service role w server actions — bez INSERT/UPDATE/DELETE dla authenticated.

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'department-board-images',
  'department-board-images',
  false,
  5242880, -- 5 MB po kompresji
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO UPDATE SET
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types,
  public = false;
