-- 205_rol_fs_pdfs.sql
-- Wydruki FS do PDF dla zgłoszeń ROL (docs/plans/rol-ivoclar-zgloszenia.md, plasterek 4).
-- Subiekt drukuje FS ok. 45 s na fakturę, więc PDF-y pobieramy w tle zaraz po skanie i trzymamy
-- do wysyłki. Jeden wiersz na FS (ta sama FS może być w paczkach dwóch klientów przy konflikcie).
CREATE TABLE IF NOT EXISTS public.rol_fs_pdfs (
  fs_dok_id integer PRIMARY KEY,
  pdf bytea NULL,
  fetched_at timestamptz NULL,
  attempts integer NOT NULL DEFAULT 0,
  last_error text NOT NULL DEFAULT '',
  -- Ostatnia próba (także w toku) — drugi przebieg nie drukuje tej samej FS równolegle.
  last_attempt_at timestamptz NULL,
  CONSTRAINT rol_fs_pdfs_pdf_size CHECK (pdf IS NULL OR octet_length(pdf) BETWEEN 4 AND 20000000)
);

ALTER TABLE public.rol_fs_pdfs DISABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'ontime_app') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON public.rol_fs_pdfs TO ontime_app;
  END IF;
END
$$;
