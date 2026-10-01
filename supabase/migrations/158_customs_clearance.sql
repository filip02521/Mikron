-- 158_customs_clearance.sql
-- Odprawy celne importu (spoza UE → PL): faktura dostawcy + ZD z Subiekta.
--
-- customs_product_cards      — „pamięć” opisów celnych: raz zatwierdzony artykuł
--                               dostawcy wypełnia się sam w kolejnych odprawach.
-- customs_product_card_events — historia zmian i zatwierdzeń karty (kto, kiedy, co).
-- customs_document_articles  — artykuły wymienione w dokumentach dostawcy
--                               (np. Annex A deklaracji zgodności) → podstawa VAT 8%.
-- customs_clearances         — jedna odprawa (faktura, ZD, status, wysłany mail).
-- customs_clearance_lines    — pozycje faktury z migawką wartości wysłanych agencji.
--
-- Czysty PostgreSQL, RLS wyłączone (autoryzacja w warstwie aplikacji).

CREATE TABLE IF NOT EXISTS public.customs_product_cards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id uuid NOT NULL REFERENCES public.suppliers(id) ON DELETE CASCADE,
  -- Numer artykułu u dostawcy, znormalizowany (np. „DE-1196”).
  supplier_article_code text NOT NULL,
  subiekt_tw_id integer,
  supplier_name text NOT NULL DEFAULT '',
  description_pl text NOT NULL DEFAULT '',
  material text NOT NULL DEFAULT '',
  usage text NOT NULL DEFAULT '',
  cn_code text,
  is_medical_device boolean NOT NULL DEFAULT false,
  vat_rate smallint,
  -- Dokument z karty dostawcy uzasadniający stawkę (np. deklaracja zgodności).
  vat_basis_document_id uuid REFERENCES public.supplier_customs_documents(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'proposed',
  source text NOT NULL DEFAULT 'manual',
  confirmed_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  confirmed_at timestamptz,
  last_clearance_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT customs_product_cards_code_len
    CHECK (char_length(supplier_article_code) BETWEEN 1 AND 120),
  CONSTRAINT customs_product_cards_cn_format
    CHECK (cn_code IS NULL OR cn_code ~ '^[0-9]{8}$'),
  CONSTRAINT customs_product_cards_vat
    CHECK (vat_rate IS NULL OR vat_rate IN (0, 5, 8, 23)),
  CONSTRAINT customs_product_cards_status
    CHECK (status IN ('proposed', 'confirmed')),
  CONSTRAINT customs_product_cards_source
    CHECK (source IN ('manual', 'ai', 'copied')),
  CONSTRAINT customs_product_cards_confirmed_at
    CHECK (status <> 'confirmed' OR confirmed_at IS NOT NULL),
  CONSTRAINT customs_product_cards_unique_article
    UNIQUE (supplier_id, supplier_article_code)
);

CREATE INDEX IF NOT EXISTS customs_product_cards_tw_idx
  ON public.customs_product_cards (subiekt_tw_id)
  WHERE subiekt_tw_id IS NOT NULL;

COMMENT ON TABLE public.customs_product_cards IS
  'Karta celna artykułu dostawcy (opis PL, materiał, CN, VAT) — zatwierdzona raz, używana w kolejnych odprawach.';

CREATE TABLE IF NOT EXISTS public.customs_product_card_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  card_id uuid NOT NULL REFERENCES public.customs_product_cards(id) ON DELETE CASCADE,
  clearance_id uuid,
  action text NOT NULL,
  changed_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  before jsonb,
  after jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT customs_product_card_events_action
    CHECK (action IN ('created', 'updated', 'confirmed', 'unconfirmed'))
);

CREATE INDEX IF NOT EXISTS customs_product_card_events_card_idx
  ON public.customs_product_card_events (card_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.customs_document_articles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id uuid NOT NULL REFERENCES public.supplier_customs_documents(id) ON DELETE CASCADE,
  supplier_article_code text NOT NULL,
  description text NOT NULL DEFAULT '',
  source text NOT NULL DEFAULT 'manual',
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT customs_document_articles_source
    CHECK (source IN ('manual', 'ai')),
  CONSTRAINT customs_document_articles_unique
    UNIQUE (document_id, supplier_article_code)
);

CREATE INDEX IF NOT EXISTS customs_document_articles_code_idx
  ON public.customs_document_articles (supplier_article_code);

COMMENT ON TABLE public.customs_document_articles IS
  'Artykuły wymienione w dokumencie dostawcy (np. Annex A deklaracji zgodności) — podstawa VAT 8% dla wyrobów medycznych.';

CREATE TABLE IF NOT EXISTS public.customs_clearances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id uuid NOT NULL REFERENCES public.suppliers(id) ON DELETE RESTRICT,
  subiekt_zd_id integer,
  zd_number text,
  invoice_number text NOT NULL DEFAULT '',
  invoice_date date,
  currency text NOT NULL DEFAULT 'EUR',
  invoice_total numeric(14, 2),
  invoice_hs_code text,
  country_of_origin text,
  -- „Przesyłka zawiera …” w mailu do agencji (np. „przyrządy używane w protetyce stomatologicznej”).
  shipment_description text NOT NULL DEFAULT '',
  invoice_storage_path text,
  invoice_file_name text,
  status text NOT NULL DEFAULT 'draft',
  email_text text,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  sent_at timestamptz,
  CONSTRAINT customs_clearances_status
    CHECK (status IN ('draft', 'sent')),
  CONSTRAINT customs_clearances_sent_at
    CHECK (status <> 'sent' OR sent_at IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS customs_clearances_supplier_idx
  ON public.customs_clearances (supplier_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.customs_clearance_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clearance_id uuid NOT NULL REFERENCES public.customs_clearances(id) ON DELETE CASCADE,
  position integer NOT NULL,
  supplier_article_code text NOT NULL DEFAULT '',
  supplier_name text NOT NULL DEFAULT '',
  quantity numeric(14, 3) NOT NULL DEFAULT 0,
  unit text NOT NULL DEFAULT 'szt.',
  unit_price numeric(14, 4),
  amount numeric(14, 2),
  card_id uuid REFERENCES public.customs_product_cards(id) ON DELETE SET NULL,
  subiekt_tw_id integer,
  zd_quantity numeric(14, 3),
  -- Wartości wysłane agencji (opis, materiał, CN, VAT, dokument) — nie zmieniają się po edycji karty.
  sent_snapshot jsonb,
  CONSTRAINT customs_clearance_lines_unique_position
    UNIQUE (clearance_id, position)
);

-- Powiązania wstecz (tabele istnieją dopiero teraz).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'customs_product_cards_last_clearance_fk'
  ) THEN
    ALTER TABLE public.customs_product_cards
      ADD CONSTRAINT customs_product_cards_last_clearance_fk
      FOREIGN KEY (last_clearance_id) REFERENCES public.customs_clearances(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'customs_product_card_events_clearance_fk'
  ) THEN
    ALTER TABLE public.customs_product_card_events
      ADD CONSTRAINT customs_product_card_events_clearance_fk
      FOREIGN KEY (clearance_id) REFERENCES public.customs_clearances(id) ON DELETE SET NULL;
  END IF;
END
$$;

ALTER TABLE public.customs_product_cards DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.customs_product_card_events DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.customs_document_articles DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.customs_clearances DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.customs_clearance_lines DISABLE ROW LEVEL SECURITY;

-- Granty dla roli aplikacji (bezpieczne, gdy rola nie istnieje).
DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'ontime_app') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON
      public.customs_product_cards,
      public.customs_product_card_events,
      public.customs_document_articles,
      public.customs_clearances,
      public.customs_clearance_lines
    TO ontime_app;
  END IF;
END
$$;
