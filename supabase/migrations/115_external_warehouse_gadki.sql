-- Magazyn zewnętrzny Gądki — podgląd stałych ZK (operacje dostaw).
-- RLS: public.is_operations() (admin + zakupy/dostawy).

CREATE TABLE IF NOT EXISTS external_warehouse_sites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT external_warehouse_sites_slug_nonempty CHECK (length(btrim(slug)) > 0),
  CONSTRAINT external_warehouse_sites_name_nonempty CHECK (length(btrim(name)) > 0)
);

INSERT INTO external_warehouse_sites (slug, name)
VALUES ('gadki', 'Magazyn Gądki')
ON CONFLICT (slug) DO NOTHING;

CREATE TABLE IF NOT EXISTS external_warehouse_zk_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id UUID NOT NULL REFERENCES external_warehouse_sites(id) ON DELETE CASCADE,
  subiekt_dok_id INTEGER NOT NULL,
  zk_number TEXT NOT NULL,
  client_label TEXT NOT NULL DEFAULT '',
  label TEXT NULL,
  last_snapshot JSONB NULL,
  line_summary TEXT NULL,
  snapshot_hash TEXT NULL,
  last_synced_at TIMESTAMPTZ NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT external_warehouse_zk_links_dok_positive CHECK (subiekt_dok_id > 0),
  CONSTRAINT external_warehouse_zk_links_zk_number_nonempty CHECK (length(btrim(zk_number)) > 0),
  CONSTRAINT external_warehouse_zk_links_label_len CHECK (label IS NULL OR char_length(label) <= 120),
  CONSTRAINT external_warehouse_zk_links_site_dok_uid UNIQUE (site_id, subiekt_dok_id)
);

CREATE INDEX IF NOT EXISTS external_warehouse_zk_links_site_sort_idx
  ON external_warehouse_zk_links (site_id, sort_order, created_at);

CREATE TABLE IF NOT EXISTS external_warehouse_line_meta (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  zk_link_id UUID NOT NULL REFERENCES external_warehouse_zk_links(id) ON DELETE CASCADE,
  line_key TEXT NOT NULL,
  pallet_label TEXT NULL,
  note TEXT NULL,
  updated_by UUID NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT external_warehouse_line_meta_key_nonempty CHECK (length(btrim(line_key)) > 0),
  CONSTRAINT external_warehouse_line_meta_pallet_len CHECK (
    pallet_label IS NULL OR char_length(pallet_label) <= 80
  ),
  CONSTRAINT external_warehouse_line_meta_note_len CHECK (
    note IS NULL OR char_length(note) <= 2000
  ),
  CONSTRAINT external_warehouse_line_meta_link_key_uid UNIQUE (zk_link_id, line_key)
);

CREATE INDEX IF NOT EXISTS external_warehouse_line_meta_pallet_idx
  ON external_warehouse_line_meta (zk_link_id, pallet_label);

CREATE TABLE IF NOT EXISTS external_warehouse_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id UUID NOT NULL REFERENCES external_warehouse_sites(id) ON DELETE CASCADE,
  zk_link_id UUID NULL REFERENCES external_warehouse_zk_links(id) ON DELETE SET NULL,
  body TEXT NOT NULL,
  created_by UUID NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  archived_at TIMESTAMPTZ NULL,
  CONSTRAINT external_warehouse_notes_body_nonempty CHECK (length(btrim(body)) > 0),
  CONSTRAINT external_warehouse_notes_body_len CHECK (char_length(body) <= 2000)
);

CREATE INDEX IF NOT EXISTS external_warehouse_notes_site_created_idx
  ON external_warehouse_notes (site_id, created_at DESC)
  WHERE archived_at IS NULL;

CREATE TABLE IF NOT EXISTS external_warehouse_change_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id UUID NOT NULL REFERENCES external_warehouse_sites(id) ON DELETE CASCADE,
  zk_link_id UUID NULL REFERENCES external_warehouse_zk_links(id) ON DELETE SET NULL,
  kind TEXT NOT NULL,
  summary TEXT NOT NULL,
  meta JSONB NOT NULL DEFAULT '{}'::jsonb,
  actor_user_id UUID NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT external_warehouse_change_log_kind_check CHECK (
    kind IN (
      'zk_linked',
      'zk_unlinked',
      'lines_added',
      'lines_removed',
      'qty_changed',
      'pallet_changed',
      'pallet_renamed',
      'line_note',
      'site_note'
    )
  ),
  CONSTRAINT external_warehouse_change_log_summary_nonempty CHECK (length(btrim(summary)) > 0)
);

CREATE INDEX IF NOT EXISTS external_warehouse_change_log_site_created_idx
  ON external_warehouse_change_log (site_id, created_at DESC);

-- RLS
ALTER TABLE external_warehouse_sites ENABLE ROW LEVEL SECURITY;
ALTER TABLE external_warehouse_zk_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE external_warehouse_line_meta ENABLE ROW LEVEL SECURITY;
ALTER TABLE external_warehouse_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE external_warehouse_change_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS external_warehouse_sites_all ON external_warehouse_sites;
CREATE POLICY external_warehouse_sites_all ON external_warehouse_sites
  FOR ALL TO authenticated
  USING (public.is_operations())
  WITH CHECK (public.is_operations());

DROP POLICY IF EXISTS external_warehouse_zk_links_all ON external_warehouse_zk_links;
CREATE POLICY external_warehouse_zk_links_all ON external_warehouse_zk_links
  FOR ALL TO authenticated
  USING (public.is_operations())
  WITH CHECK (public.is_operations());

DROP POLICY IF EXISTS external_warehouse_line_meta_all ON external_warehouse_line_meta;
CREATE POLICY external_warehouse_line_meta_all ON external_warehouse_line_meta
  FOR ALL TO authenticated
  USING (public.is_operations())
  WITH CHECK (public.is_operations());

DROP POLICY IF EXISTS external_warehouse_notes_all ON external_warehouse_notes;
CREATE POLICY external_warehouse_notes_all ON external_warehouse_notes
  FOR ALL TO authenticated
  USING (public.is_operations())
  WITH CHECK (public.is_operations());

DROP POLICY IF EXISTS external_warehouse_change_log_all ON external_warehouse_change_log;
CREATE POLICY external_warehouse_change_log_all ON external_warehouse_change_log
  FOR ALL TO authenticated
  USING (public.is_operations())
  WITH CHECK (public.is_operations());

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE external_warehouse_sites TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE external_warehouse_zk_links TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE external_warehouse_line_meta TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE external_warehouse_notes TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE external_warehouse_change_log TO authenticated;

GRANT EXECUTE ON FUNCTION public.is_operations() TO authenticated, anon;

COMMENT ON TABLE external_warehouse_sites IS
  'Magazyny zewnętrzne (np. Gądki) — konfiguracja podglądu stałych ZK.';
COMMENT ON TABLE external_warehouse_zk_links IS
  'Powiązane ZK Subiekta dla magazynu zewnętrznego; last_snapshot = przycięty dokument.';
COMMENT ON TABLE external_warehouse_line_meta IS
  'Meta pozycji ZK (paleta, notatka) — klucz linii jak w notatniku ZK.';
COMMENT ON TABLE external_warehouse_notes IS
  'Notatki magazynu zewnętrznego (site lub opcjonalnie ZK).';
COMMENT ON TABLE external_warehouse_change_log IS
  'Dziennik zmian sync/meta magazynu zewnętrznego (bez pełnego JSON Subiekta).';

NOTIFY pgrst, 'reload schema';
