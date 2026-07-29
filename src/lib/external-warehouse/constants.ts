/** Limity i stałe magazynu zewnętrznego Gądki. */

export const GADKI_SITE_SLUG = "gadki";
export const GADKI_PAGE_PATH = "/zakupy/gadki";

export const MAX_EXTERNAL_WAREHOUSE_ZK_LINKS = 10;
export const MAX_EXTERNAL_WAREHOUSE_NOTE_LEN = 2000;
export const MAX_EXTERNAL_WAREHOUSE_PALLET_LABEL_LEN = 80;
export const MAX_EXTERNAL_WAREHOUSE_ZK_LABEL_LEN = 120;
export const MAX_EXTERNAL_WAREHOUSE_CHANGE_LOG_UI = 100;

/** Min. odstęp między automatycznymi syncami Subiekta (wejście na stronę). */
export const EXTERNAL_WAREHOUSE_SYNC_DEBOUNCE_MS = 45_000;

export const EXTERNAL_WAREHOUSE_SYNC_LOCK_TTL_SEC = 30;
export const EXTERNAL_WAREHOUSE_SYNC_CONCURRENCY = 3;

export function gadkiZkSyncLockKey(linkId: string): string {
  return `gadki-zk-sync:${linkId}`;
}
