-- Log transakcyjnych maili OnTime (dostawy, informacja, OTP, tablica itd.).
-- Osobno od mail_send_log (Ivoclar / OnTime Raporty).

CREATE TABLE IF NOT EXISTS transactional_email_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kind TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('sent', 'failed')),
  to_addresses TEXT[] NOT NULL DEFAULT '{}',
  cc_addresses TEXT[] NOT NULL DEFAULT '{}',
  bcc_addresses TEXT[] NOT NULL DEFAULT '{}',
  intended_to TEXT[] NOT NULL DEFAULT '{}',
  override_to TEXT NULL,
  from_address TEXT NOT NULL DEFAULT '',
  subject TEXT NOT NULL DEFAULT '',
  html_body TEXT NOT NULL DEFAULT '',
  message_id TEXT NULL,
  error_message TEXT NULL,
  has_attachments BOOLEAN NOT NULL DEFAULT false,
  attachment_names TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_transactional_email_log_created
  ON transactional_email_log (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_transactional_email_log_kind_created
  ON transactional_email_log (kind, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_transactional_email_log_status_created
  ON transactional_email_log (status, created_at DESC);

ALTER TABLE transactional_email_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY admin_all_transactional_email_log ON transactional_email_log
  FOR ALL USING (public.is_admin());

COMMENT ON TABLE transactional_email_log IS
  'Historia wysyłek transakcyjnych OnTime (SES SMTP) z treścią HTML do podglądu w adminie. Kody OTP są redagowane przed zapisem.';
