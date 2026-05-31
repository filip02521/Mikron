-- Zgłoszenia problemów od handlowców (osobna skrzynka w adminie).

CREATE TABLE sales_bug_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  sales_person_id UUID REFERENCES sales_people(id) ON DELETE SET NULL,
  reporter_name TEXT NOT NULL,
  reporter_email TEXT,
  page_path TEXT NOT NULL DEFAULT '/',
  message TEXT NOT NULL,
  user_agent TEXT,
  status TEXT NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'triaged', 'closed')),
  admin_note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX sales_bug_reports_status_created_idx
  ON sales_bug_reports (status, created_at DESC);

CREATE INDEX sales_bug_reports_person_idx
  ON sales_bug_reports (sales_person_id, created_at DESC);

ALTER TABLE sales_bug_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY sales_bug_reports_admin ON sales_bug_reports
  FOR ALL
  USING (public.is_admin());

CREATE POLICY sales_bug_reports_own_select ON sales_bug_reports
  FOR SELECT
  USING (
    public.is_sales_account()
    AND sales_person_id = public.my_sales_person_id()
  );

CREATE POLICY sales_bug_reports_own_insert ON sales_bug_reports
  FOR INSERT
  WITH CHECK (
    public.is_sales_account()
    AND sales_person_id = public.my_sales_person_id()
    AND profile_id = auth.uid()
  );

COMMENT ON TABLE sales_bug_reports IS
  'Zgłoszenia błędów / uwag od handlowców — widoczne w adminie.';
