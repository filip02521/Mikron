-- Notatnik handlowca: własne notatki + obserwowane ZK (oczekujące na towar).

CREATE TABLE sales_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sales_person_id UUID NOT NULL REFERENCES sales_people(id) ON DELETE CASCADE,
  title TEXT,
  body TEXT NOT NULL DEFAULT '',
  color TEXT NOT NULL DEFAULT 'default',
  pinned BOOLEAN NOT NULL DEFAULT false,
  archived_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX sales_notes_person_active_idx
  ON sales_notes (sales_person_id, archived_at, pinned DESC, updated_at DESC);

CREATE TABLE sales_payment_watches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sales_person_id UUID NOT NULL REFERENCES sales_people(id) ON DELETE CASCADE,
  subiekt_dok_id INTEGER NOT NULL,
  zk_number TEXT NOT NULL,
  client_label TEXT NOT NULL,
  client_kh_id INTEGER,
  amount_net NUMERIC,
  amount_gross NUMERIC,
  zk_issued_at DATE,
  due_at DATE,
  note TEXT,
  line_summary TEXT,
  subiekt_snapshot JSONB,
  settled_at TIMESTAMPTZ,
  archived_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (sales_person_id, subiekt_dok_id)
);

CREATE INDEX sales_payment_watches_person_active_idx
  ON sales_payment_watches (sales_person_id, settled_at, archived_at, created_at ASC);

ALTER TABLE sales_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales_payment_watches ENABLE ROW LEVEL SECURITY;

CREATE POLICY sales_notes_admin ON sales_notes FOR ALL USING (public.is_admin());
CREATE POLICY sales_payment_watches_admin ON sales_payment_watches FOR ALL USING (public.is_admin());
