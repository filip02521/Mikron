-- 166_department_board_reply_images.sql
-- Zdjęcia w odpowiedziach na Tablicy (w obie strony: zakupy ↔ handlowiec).
-- post_id NULL = zdjęcie dołączone do samego pytania (jak dotąd).

ALTER TABLE public.department_board_thread_attachments
  ADD COLUMN IF NOT EXISTS post_id uuid
    REFERENCES public.department_board_posts(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS department_board_thread_attachments_post_idx
  ON public.department_board_thread_attachments (post_id)
  WHERE post_id IS NOT NULL;

-- Odpowiedź może być samym zdjęciem — wymóg „tekst albo zdjęcie” pilnuje aplikacja.
ALTER TABLE public.department_board_posts
  DROP CONSTRAINT IF EXISTS department_board_posts_body_check;

ALTER TABLE public.department_board_posts
  DROP CONSTRAINT IF EXISTS department_board_posts_body_len;

ALTER TABLE public.department_board_posts
  ADD CONSTRAINT department_board_posts_body_len CHECK (char_length(body) <= 8000);
