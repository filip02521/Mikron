-- 214_mikran_api_connection.sql
-- Połączenie OnTime z API sklepu mikran.pl (helpdesk) przez logowanie administratora (OAuth authorization_code + PKCE).
-- Jeden wiersz na całą aplikację: refresh token szyfrowany w aplikacji (AES-256-GCM), access token jako pamięć podręczna.

CREATE TABLE IF NOT EXISTS public.mikran_api_connection (
  id smallint PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  refresh_token_enc text NOT NULL,
  access_token_enc text,
  access_expires_at timestamptz,
  scope text NOT NULL DEFAULT '',
  connected_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  connected_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.mikran_api_connection IS
  'API mikran.pl (helpdesk) połączone logowaniem admina. Usunięcie wiersza = odłączenie; tokeny szyfrowane w aplikacji.';

DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'ontime_app') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON public.mikran_api_connection TO ontime_app;
  END IF;
END
$$;
