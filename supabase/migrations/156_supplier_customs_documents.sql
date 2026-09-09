-- 156_supplier_customs_documents.sql
-- Dokumenty wymagane do odpraw celnych, dodawane na karcie dostawcy IMPORT.
-- Każdy plik ma własny opis/komentarz. Pliki w prywatnym buckecie; dostęp przez server actions.

CREATE TABLE IF NOT EXISTS public.supplier_customs_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id uuid NOT NULL REFERENCES public.suppliers(id) ON DELETE CASCADE,
  created_by uuid NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
  storage_path text NOT NULL,
  file_name text NOT NULL DEFAULT '',
  description text NOT NULL DEFAULT '',
  mime_type text NOT NULL DEFAULT 'application/octet-stream',
  byte_size integer,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT supplier_customs_documents_path_len
    CHECK (char_length(storage_path) BETWEEN 1 AND 500),
  CONSTRAINT supplier_customs_documents_name_len
    CHECK (char_length(file_name) <= 255),
  CONSTRAINT supplier_customs_documents_desc_len
    CHECK (char_length(description) <= 1000),
  CONSTRAINT supplier_customs_documents_path_unique
    UNIQUE (storage_path)
);

CREATE INDEX IF NOT EXISTS supplier_customs_documents_supplier_idx
  ON public.supplier_customs_documents (supplier_id, created_at DESC);

COMMENT ON TABLE public.supplier_customs_documents IS
  'Dokumenty odpraw celnych dla dostawców IMPORT (ścieżka w Storage + opis per plik).';

ALTER TABLE public.supplier_customs_documents DISABLE ROW LEVEL SECURITY;

-- RLS wyłączone zgodnie z konwencją projektu (autoryzacja w warstwie aplikacji).
-- Mutacje i odczyt idą przez service role w server actions.

-- Storage bucket dla dokumentów odpraw (PDF, obrazy, dokumenty).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM storage.buckets WHERE id = 'customs-documents'
  ) THEN
    INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    VALUES (
      'customs-documents',
      'customs-documents',
      false,
      20971520, -- 20 MB
      ARRAY[
        'application/pdf',
        'image/jpeg',
        'image/png',
        'image/webp',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'application/vnd.ms-excel',
        'application/msword',
        'text/plain',
        'text/csv'
      ]
    );
  END IF;
END
$$;
