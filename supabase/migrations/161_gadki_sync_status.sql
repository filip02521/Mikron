-- 161_gadki_sync_status.sql
-- Magazyn Gądki: stan synchronizacji ZK widoczny w UI i nowe rodzaje wpisów dziennika.
--
-- last_sync_error / last_sync_error_at — ostatni błąd pobrania ZK z Subiekta (null = OK).
--   Np. ZK usunięte w Subiekcie: pozycje zostają z ostatniego snapshotu, UI pokazuje „Brak w Subiekcie”.
-- last_sync_attempt_at — ostatnia próba synchronizacji (także nieudana).
--
-- Dziennik: line_changed (zmiana towaru / nazwy pozycji), zk_replaced (ZK podmienione na nowy
-- dokument Subiekta), shares_rebalanced (automatyczna korekta palet po zmniejszeniu ilości w ZK).

ALTER TABLE public.external_warehouse_zk_links
  ADD COLUMN IF NOT EXISTS last_sync_error text NULL,
  ADD COLUMN IF NOT EXISTS last_sync_error_at timestamptz NULL,
  ADD COLUMN IF NOT EXISTS last_sync_attempt_at timestamptz NULL;

ALTER TABLE public.external_warehouse_zk_links
  DROP CONSTRAINT IF EXISTS external_warehouse_zk_links_sync_error_len;
ALTER TABLE public.external_warehouse_zk_links
  ADD CONSTRAINT external_warehouse_zk_links_sync_error_len
  CHECK (last_sync_error IS NULL OR char_length(last_sync_error) <= 500);

COMMENT ON COLUMN public.external_warehouse_zk_links.last_sync_error IS
  'Ostatni błąd synchronizacji ZK z Subiektem (null = ostatni sync udany).';

ALTER TABLE public.external_warehouse_change_log
  DROP CONSTRAINT IF EXISTS external_warehouse_change_log_kind_check;

ALTER TABLE public.external_warehouse_change_log
  ADD CONSTRAINT external_warehouse_change_log_kind_check CHECK (
    kind IN (
      'zk_linked',
      'zk_unlinked',
      'zk_replaced',
      'lines_added',
      'lines_removed',
      'qty_changed',
      'line_changed',
      'pallet_changed',
      'pallet_renamed',
      'pallet_shares_changed',
      'shares_rebalanced',
      'line_note',
      'site_note'
    )
  );
