-- 175_oc_checks.sql
-- Kontrola potwierdzeń zamówień (OC) od dostawców względem ZD (plan: docs/plans/asystent-kontrola-oc.md).
--
-- oc_checks        — jedna sprawa: OC / pro-forma / PI dopasowane do ZD, status i decyzja działu.
-- oc_check_lines   — pozycje porównania (zamówiono vs potwierdzono) z rodzajem różnicy.
-- gmail_sync_state — punkt, od którego kolejny przebieg czyta skrzynkę (History API).
--
-- Czysty PostgreSQL, RLS wyłączone (autoryzacja w warstwie aplikacji).

CREATE TABLE IF NOT EXISTS public.oc_checks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Klucz idempotencji importu: ta sama wiadomość z OC nie tworzy drugiej sprawy.
  source_key text NOT NULL,
  source text NOT NULL DEFAULT 'import',
  mailbox text NOT NULL DEFAULT '',
  gmail_thread_id text,
  gmail_message_id text,
  supplier_id uuid REFERENCES public.suppliers(id) ON DELETE SET NULL,
  -- Nazwa z dokumentu — zostaje, nawet gdy dostawcy nie dopasowano do kartoteki.
  supplier_name text NOT NULL DEFAULT '',
  zd_number text NOT NULL DEFAULT '',
  zd_subiekt_id integer,
  oc_number text NOT NULL DEFAULT '',
  oc_received_at timestamptz,
  status text NOT NULL,
  priority smallint NOT NULL DEFAULT 0,
  summary text NOT NULL DEFAULT '',
  next_step text NOT NULL DEFAULT '',
  lines_total integer,
  lines_ok integer,
  resolved_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  resolved_at timestamptz,
  resolution_note text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT oc_checks_source_key_unique UNIQUE (source_key),
  CONSTRAINT oc_checks_source CHECK (source IN ('import', 'gmail')),
  CONSTRAINT oc_checks_status
    CHECK (status IN ('zgodne', 'rozbieznosci', 'czeka_na_nas', 'brak_oc', 'nie_da_sie')),
  CONSTRAINT oc_checks_priority CHECK (priority BETWEEN 0 AND 2),
  CONSTRAINT oc_checks_lines CHECK (
    (lines_total IS NULL AND lines_ok IS NULL)
    OR (lines_total >= 0 AND lines_ok >= 0 AND lines_ok <= lines_total)
  ),
  -- resolved_by może zniknąć (usunięty profil), ale nie może być bez daty.
  CONSTRAINT oc_checks_resolved CHECK (resolved_by IS NULL OR resolved_at IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS oc_checks_open_idx
  ON public.oc_checks (priority DESC, oc_received_at DESC)
  WHERE resolved_at IS NULL;
CREATE INDEX IF NOT EXISTS oc_checks_zd_idx
  ON public.oc_checks (zd_number)
  WHERE zd_number <> '';
CREATE INDEX IF NOT EXISTS oc_checks_supplier_idx
  ON public.oc_checks (supplier_id)
  WHERE supplier_id IS NOT NULL;

COMMENT ON TABLE public.oc_checks IS
  'Sprawa kontroli OC: potwierdzenie dostawcy porównane z ZD, status i decyzja działu zakupów.';
COMMENT ON COLUMN public.oc_checks.status IS
  'zgodne | rozbieznosci | czeka_na_nas (potwierdzenie/płatność) | brak_oc (wysłane ZD, brak odpowiedzi) | nie_da_sie (brak ZD lub nieczytelne OC).';
COMMENT ON COLUMN public.oc_checks.next_step IS 'Konkretny ruch dla działu, np. „Potwierdź OC i przekaż przedpłatę”.';

CREATE TABLE IF NOT EXISTS public.oc_check_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  check_id uuid NOT NULL REFERENCES public.oc_checks(id) ON DELETE CASCADE,
  position smallint NOT NULL,
  symbol text NOT NULL DEFAULT '',
  name text NOT NULL DEFAULT '',
  qty_ordered numeric(14, 3),
  qty_confirmed numeric(14, 3),
  unit_ordered text NOT NULL DEFAULT '',
  unit_confirmed text NOT NULL DEFAULT '',
  price_ordered numeric(14, 4),
  price_confirmed numeric(14, 4),
  currency text NOT NULL DEFAULT '',
  delivery_date date,
  kind text NOT NULL,
  note text NOT NULL DEFAULT '',
  CONSTRAINT oc_check_lines_kind CHECK (
    kind IN ('ok', 'ilosc', 'jednostka', 'cena', 'termin', 'zamiennik', 'brak', 'dodatkowa', 'koszt')
  ),
  CONSTRAINT oc_check_lines_position UNIQUE (check_id, position)
);

COMMENT ON TABLE public.oc_check_lines IS
  'Pozycje porównania OC ↔ ZD. Zapisujemy wszystkie różnice; pozycje zgodne tylko gdy źródło je podaje.';

CREATE TABLE IF NOT EXISTS public.gmail_sync_state (
  mailbox text PRIMARY KEY,
  history_id text,
  last_run_at timestamptz,
  last_error text NOT NULL DEFAULT '',
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.gmail_sync_state IS
  'Stan przyrostowego odczytu skrzynek (Gmail History API) dla kontroli OC.';
