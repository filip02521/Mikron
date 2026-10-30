-- 204_rol_reports.sql
-- Comiesięczne zgłoszenia ROL do Ivoclara (docs/plans/rol-ivoclar-zgloszenia.md): klienci ROL
-- (konfiguracja tylko w bazie — repo jest publiczne), domyślne ustawienia maila i paczka miesiąca
-- (klient × miesiąc) z FS i pozycjami Ivoclar znalezionymi przez skan. Wysyłka (rol_sends) dojdzie
-- w osobnej migracji razem z plasterkiem wysyłki.

CREATE TABLE IF NOT EXISTS public.rol_programs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Etykieta w treści maila i w opisie ZD („ROL <label> <miesiąc>”).
  label text NOT NULL,
  -- Nazwa klienta w nazwach plików.
  file_label text NOT NULL,
  -- Kartoteki klienta w Subiekcie (kh_Id); FS pasuje po płatniku albo odbiorcy.
  kh_ids integer[] NOT NULL,
  discount_pct numeric NOT NULL DEFAULT 25,
  address_lines text[] NOT NULL DEFAULT '{}',
  nip text NOT NULL DEFAULT '',
  -- Puste → domyślni adresaci z rol_mail_settings.
  to_emails text[] NOT NULL DEFAULT '{}',
  cc_emails text[] NOT NULL DEFAULT '{}',
  send_mode text NOT NULL DEFAULT 'review',
  auto_sender_user_id uuid NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
  active_from date NOT NULL,
  active_to date NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT rol_programs_label_len CHECK (char_length(label) BETWEEN 1 AND 120),
  CONSTRAINT rol_programs_file_label_len CHECK (char_length(file_label) BETWEEN 1 AND 80),
  CONSTRAINT rol_programs_kh_ids_nonempty CHECK (cardinality(kh_ids) > 0),
  CONSTRAINT rol_programs_discount CHECK (discount_pct > 0 AND discount_pct < 100),
  CONSTRAINT rol_programs_send_mode CHECK (send_mode IN ('review', 'auto')),
  CONSTRAINT rol_programs_active_range CHECK (active_to IS NULL OR active_to >= active_from)
);

-- Jeden wiersz (id = 1): domyślni adresaci i szablon maila.
CREATE TABLE IF NOT EXISTS public.rol_mail_settings (
  id smallint PRIMARY KEY DEFAULT 1,
  to_emails text[] NOT NULL DEFAULT '{}',
  cc_emails text[] NOT NULL DEFAULT '{}',
  subject_template text NOT NULL DEFAULT 'New Order',
  updated_by uuid NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT rol_mail_settings_singleton CHECK (id = 1)
);

CREATE TABLE IF NOT EXISTS public.rol_batches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id uuid NOT NULL REFERENCES public.rol_programs(id) ON DELETE CASCADE,
  -- Pierwszy dzień zgłaszanego miesiąca.
  period date NOT NULL,
  status text NOT NULL DEFAULT 'wykryte',
  scanned_at timestamptz NOT NULL DEFAULT now(),
  -- Ile FS z miesiąca przejrzał skan (wszystkich klientów) — dowód, że nic nie zginęło.
  fs_checked_count integer NOT NULL DEFAULT 0,
  -- Odcisk wyniku skanu; zmiana po przeglądzie cofa paczkę do „wykryte”.
  content_hash text NOT NULL DEFAULT '',
  -- Ostatnia zmiana względem poprzedniego skanu, np. „+1 FS od przeglądu”.
  change_note text NOT NULL DEFAULT '',
  -- FS, które doszły po wysłaniu (paczka zostaje „wyslane”).
  late_fs_count integer NOT NULL DEFAULT 0,
  reviewed_by uuid NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
  reviewed_at timestamptz NULL,
  sending_at timestamptz NULL,
  zd_dok_id integer NULL,
  zd_nr text NULL,
  CONSTRAINT rol_batches_period_first_day CHECK (extract(day FROM period) = 1),
  CONSTRAINT rol_batches_status CHECK (
    status IN ('wykryte', 'brak_zakupow', 'przejrzane', 'wyslane', 'potwierdzone', 'do_korekty')
  ),
  CONSTRAINT rol_batches_program_period_key UNIQUE (program_id, period)
);

CREATE INDEX IF NOT EXISTS rol_batches_period_idx ON public.rol_batches (period DESC);

CREATE TABLE IF NOT EXISTS public.rol_batch_invoices (
  batch_id uuid NOT NULL REFERENCES public.rol_batches(id) ON DELETE CASCADE,
  fs_dok_id integer NOT NULL,
  fs_nr text NOT NULL DEFAULT '',
  fs_date date NULL,
  -- Pozycje innych producentów na tej FS (pokazujemy liczbę, żeby było widać, że nic nie zginęło).
  other_lines_count integer NOT NULL DEFAULT 0,
  kfs_dok_ids integer[] NOT NULL DEFAULT '{}',
  excluded boolean NOT NULL DEFAULT false,
  excluded_reason text NOT NULL DEFAULT '',
  PRIMARY KEY (batch_id, fs_dok_id)
);

CREATE TABLE IF NOT EXISTS public.rol_batch_lines (
  id bigserial PRIMARY KEY,
  batch_id uuid NOT NULL REFERENCES public.rol_batches(id) ON DELETE CASCADE,
  fs_dok_id integer NOT NULL,
  subiekt_tw_id integer NOT NULL,
  symbol text NOT NULL DEFAULT '',
  -- Numer katalogowy Ivoclar (6 cyfr); NULL = brak, blokuje wysyłkę.
  ivoclar_catalog_no text NULL,
  name text NOT NULL DEFAULT '',
  qty_fs numeric NOT NULL,
  -- Sztuki odjęte z korekt (KFS).
  qty_kfs numeric NOT NULL DEFAULT 0,
  qty_override numeric NULL,
  excluded boolean NOT NULL DEFAULT false,
  note text NOT NULL DEFAULT '',
  CONSTRAINT rol_batch_lines_qty_nonneg CHECK (
    qty_fs >= 0 AND qty_kfs >= 0 AND (qty_override IS NULL OR qty_override >= 0)
  )
);

CREATE INDEX IF NOT EXISTS rol_batch_lines_batch_idx ON public.rol_batch_lines (batch_id);

ALTER TABLE public.rol_programs DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.rol_mail_settings DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.rol_batches DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.rol_batch_invoices DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.rol_batch_lines DISABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'ontime_app') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON
      public.rol_programs, public.rol_mail_settings, public.rol_batches,
      public.rol_batch_invoices, public.rol_batch_lines
      TO ontime_app;
    GRANT USAGE, SELECT ON SEQUENCE public.rol_batch_lines_id_seq TO ontime_app;
  END IF;
END
$$;
