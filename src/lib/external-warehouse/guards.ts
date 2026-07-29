import { clampOptionalText, clampText } from "@/lib/security/text-limits";
import {
  MAX_EXTERNAL_WAREHOUSE_NOTE_LEN,
  MAX_EXTERNAL_WAREHOUSE_PALLET_LABEL_LEN,
  MAX_EXTERNAL_WAREHOUSE_ZK_LABEL_LEN,
  MAX_EXTERNAL_WAREHOUSE_ZK_LINKS,
} from "@/lib/external-warehouse/constants";
import {
  parsePrunedSnapshot,
  snapshotLineKeys,
} from "@/lib/external-warehouse/lines";

export function isExternalWarehouseUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value
  );
}

export function normalizePalletLabel(raw: string | null | undefined): string | null {
  return (
    clampOptionalText(raw, MAX_EXTERNAL_WAREHOUSE_PALLET_LABEL_LEN) ?? null
  );
}

export function normalizeLineNote(raw: string | null | undefined): string | null {
  return clampOptionalText(raw, MAX_EXTERNAL_WAREHOUSE_NOTE_LEN) ?? null;
}

export function normalizeZkLabel(raw: string | null | undefined): string | null {
  return clampOptionalText(raw, MAX_EXTERNAL_WAREHOUSE_ZK_LABEL_LEN) ?? null;
}

export function normalizeSiteNoteBody(raw: string): string {
  return clampText(raw, MAX_EXTERNAL_WAREHOUSE_NOTE_LEN);
}

/** line_key musi być w aktualnym snapshotcie (mutacje meta). */
export function assertLineKeyInSnapshot(
  lastSnapshot: unknown,
  lineKey: string
): { ok: true } | { ok: false; message: string } {
  const key = lineKey.trim();
  if (!key) return { ok: false, message: "Brak klucza pozycji" };
  const keys = snapshotLineKeys(parsePrunedSnapshot(lastSnapshot));
  if (!keys.has(key)) {
    return { ok: false, message: "Pozycja nie istnieje w aktualnym ZK" };
  }
  return { ok: true };
}

/** Orphan purge — line_key NIE może być w snapshotcie. */
export function assertOrphanLineKey(
  lastSnapshot: unknown,
  lineKey: string
): { ok: true } | { ok: false; message: string } {
  const key = lineKey.trim();
  if (!key) return { ok: false, message: "Brak klucza pozycji" };
  const keys = snapshotLineKeys(parsePrunedSnapshot(lastSnapshot));
  if (keys.has(key)) {
    return { ok: false, message: "Pozycja nadal jest w ZK — nie można usunąć" };
  }
  return { ok: true };
}

export function assertUnderZkLinkLimit(count: number): {
  ok: true;
} | { ok: false; message: string } {
  if (count >= MAX_EXTERNAL_WAREHOUSE_ZK_LINKS) {
    return {
      ok: false,
      message: `Maksymalnie ${MAX_EXTERNAL_WAREHOUSE_ZK_LINKS} ZK na magazyn`,
    };
  }
  return { ok: true };
}
