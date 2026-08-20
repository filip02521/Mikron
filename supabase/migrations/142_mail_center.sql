-- Centrum maili: definicje jobów, odbiorcy, log wysyłek, issues.

CREATE TABLE IF NOT EXISTS mail_job_definitions (
  id TEXT PRIMARY KEY,
  label TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  enabled BOOLEAN NOT NULL DEFAULT true,
  schedule_label TEXT NOT NULL DEFAULT '',
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS mail_job_recipients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id TEXT NOT NULL REFERENCES mail_job_definitions (id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  display_name TEXT NULL,
  recipient_role TEXT NOT NULL CHECK (recipient_role IN ('to', 'cc', 'bcc')),
  enabled BOOLEAN NOT NULL DEFAULT true,
  sort_order INT NOT NULL DEFAULT 0,
  notes TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (job_id, email, recipient_role)
);

CREATE TABLE IF NOT EXISTS mail_send_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id TEXT NOT NULL REFERENCES mail_job_definitions (id) ON DELETE CASCADE,
  period_key TEXT NOT NULL,
  attempt_no INT NOT NULL DEFAULT 1,
  trigger_kind TEXT NOT NULL CHECK (trigger_kind IN ('cron', 'manual', 'test')),
  triggered_by UUID NULL REFERENCES profiles (id) ON DELETE SET NULL,
  status TEXT NOT NULL CHECK (
    status IN ('pending', 'generating', 'sent', 'failed', 'blocked', 'skipped')
  ),
  period_from DATE NULL,
  period_to DATE NULL,
  subject TEXT NULL,
  resend_message_ids TEXT[] NOT NULL DEFAULT '{}',
  recipient_snapshot JSONB NOT NULL DEFAULT '[]'::jsonb,
  attachment_manifest JSONB NOT NULL DEFAULT '[]'::jsonb,
  summary JSONB NOT NULL DEFAULT '{}'::jsonb,
  events JSONB NOT NULL DEFAULT '[]'::jsonb,
  error_message TEXT NULL,
  had_warnings BOOLEAN NOT NULL DEFAULT false,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  finished_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS mail_send_log_one_sent_per_period
  ON mail_send_log (job_id, period_key)
  WHERE status = 'sent';

CREATE INDEX IF NOT EXISTS idx_mail_send_log_job_created
  ON mail_send_log (job_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_mail_send_log_period
  ON mail_send_log (job_id, period_key);

CREATE INDEX IF NOT EXISTS idx_mail_send_log_status_created
  ON mail_send_log (status, created_at DESC);

CREATE TABLE IF NOT EXISTS mail_send_issues (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  send_log_id UUID NOT NULL REFERENCES mail_send_log (id) ON DELETE CASCADE,
  severity TEXT NOT NULL CHECK (severity IN ('blocking', 'warning', 'info')),
  code TEXT NOT NULL,
  message TEXT NOT NULL,
  context JSONB NOT NULL DEFAULT '{}'::jsonb,
  count INT NOT NULL DEFAULT 1
);

CREATE INDEX IF NOT EXISTS idx_mail_send_issues_log
  ON mail_send_issues (send_log_id);

ALTER TABLE mail_job_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE mail_job_recipients ENABLE ROW LEVEL SECURITY;
ALTER TABLE mail_send_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE mail_send_issues ENABLE ROW LEVEL SECURITY;

CREATE POLICY admin_all_mail_job_definitions ON mail_job_definitions
  FOR ALL USING (public.is_admin());

CREATE POLICY admin_all_mail_job_recipients ON mail_job_recipients
  FOR ALL USING (public.is_admin());

CREATE POLICY admin_all_mail_send_log ON mail_send_log
  FOR ALL USING (public.is_admin());

CREATE POLICY admin_all_mail_send_issues ON mail_send_issues
  FOR ALL USING (public.is_admin());

INSERT INTO mail_job_definitions (id, label, description, enabled, schedule_label, payload)
VALUES (
  'ivoclar_weekly',
  'Raport Ivoclar — tygodniowy',
  'Sellout + Inventory (poprzedni tydzień pn–nd). Wysyłka w poniedziałek przed 10:00.',
  true,
  'pn 7:00–9:00 (Warszawa)',
  '{"kind":"ivoclar_weekly","period":"previous_complete_week"}'::jsonb
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO mail_job_recipients (job_id, email, display_name, recipient_role, enabled, sort_order)
VALUES
  ('ivoclar_weekly', 'salesdata@ivoclar.com', 'Ivoclar Sales Data', 'to', true, 1),
  ('ivoclar_weekly', 'natalia.marcinkowska@ivoclar.com', 'Natalia Marcinkowska', 'to', true, 2)
ON CONFLICT (job_id, email, recipient_role) DO NOTHING;

COMMENT ON TABLE mail_job_definitions IS 'Definicje zaplanowanych jobów mailowych (raporty, digesty).';
COMMENT ON TABLE mail_send_log IS 'Historia prób wysyłki maili; partial unique tylko na status sent per job+period_key.';
