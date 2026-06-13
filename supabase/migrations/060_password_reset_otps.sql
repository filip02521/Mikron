-- Jednorazowe kody OTP do resetu hasła z ekranu logowania (Resend + weryfikacja serwerowa).

CREATE TABLE IF NOT EXISTS password_reset_otps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  code_hash TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  attempts INT NOT NULL DEFAULT 0,
  max_attempts INT NOT NULL DEFAULT 5,
  consumed_at TIMESTAMPTZ NULL,
  request_ip TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS password_reset_otps_user_active_idx
  ON password_reset_otps (user_id, created_at DESC)
  WHERE consumed_at IS NULL;

CREATE INDEX IF NOT EXISTS password_reset_otps_email_created_idx
  ON password_reset_otps (email, created_at DESC);

COMMENT ON TABLE password_reset_otps IS
  'Kody 6-cyfrowe do self-service resetu hasła. Dostęp tylko przez service role.';

ALTER TABLE password_reset_otps ENABLE ROW LEVEL SECURITY;
