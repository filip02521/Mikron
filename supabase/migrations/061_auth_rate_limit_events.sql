-- Zdarzenia rate limit dla publicznych endpointów auth (login, weryfikacja OTP).

CREATE TABLE IF NOT EXISTS auth_rate_limit_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bucket_key TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS auth_rate_limit_events_bucket_created_idx
  ON auth_rate_limit_events (bucket_key, created_at DESC);

COMMENT ON TABLE auth_rate_limit_events IS
  'Sliding-window rate limit dla /api/auth/login i password-reset/verify. Dostęp tylko service role.';

ALTER TABLE auth_rate_limit_events ENABLE ROW LEVEL SECURITY;

NOTIFY pgrst, 'reload schema';
