-- 182_department_board_supplier_files.sql
-- Odpowiedź zakupów na tablicy może nieść pliki z maila dostawcy (oferta w PDF, cennik w Excelu…),
-- nie tylko zdjęcia. Limit 15 MB; zdjęcia od handlowców nadal ogranicza aplikacja (5 MB po kompresji).

ALTER TABLE public.department_board_thread_attachments
  DROP CONSTRAINT IF EXISTS department_board_thread_attachments_mime;
ALTER TABLE public.department_board_thread_attachments
  ADD CONSTRAINT department_board_thread_attachments_mime CHECK (mime_type IN (
    'image/jpeg', 'image/png', 'image/webp',
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/msword',
    'text/csv'
  ));

ALTER TABLE public.department_board_thread_attachments
  DROP CONSTRAINT IF EXISTS department_board_thread_attachments_size;
ALTER TABLE public.department_board_thread_attachments
  ADD CONSTRAINT department_board_thread_attachments_size
    CHECK (byte_size IS NULL OR (byte_size > 0 AND byte_size <= 15728640));

COMMENT ON TABLE public.department_board_thread_attachments IS
  'Zdjęcia i pliki (np. od dostawcy) dołączone do wątku pytania na Tablicy (ścieżka w Storage).';
