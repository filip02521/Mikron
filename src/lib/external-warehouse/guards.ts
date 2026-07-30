import { clampOptionalText, clampText } from "@/lib/security/text-limits";
import {
  MAX_EXTERNAL_WAREHOUSE_NOTE_LEN,
  MAX_EXTERNAL_WAREHOUSE_PALLET_LABEL_LEN,
  MAX_EXTERNAL_WAREHOUSE_PALLET_SHARES_PER_LINE,
  MAX_EXTERNAL_WAREHOUSE_ZK_LABEL_LEN,
  MAX_EXTERNAL_WAREHOUSE_ZK_LINKS,
} from "@/lib/external-warehouse/constants";
import {
  parsePrunedSnapshot,
  snapshotLineKeys,
  snapshotLineQty,
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

export function normalizeShareQty(raw: unknown): number | null {
  const n = typeof raw === "number" ? raw : Number(raw);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.round(n * 10000) / 10000;
}

export type NormalizedPalletShare = {
  palletLabel: string;
  qty: number;
  note: string | null;
};

function mergeShareNotes(
  a: string | null,
  b: string | null
): string | null {
  if (!a) return b;
  if (!b) return a;
  if (a === b) return a;
  const joined = `${a}; ${b}`;
  return joined.length <= MAX_EXTERNAL_WAREHOUSE_NOTE_LEN
    ? joined
    : joined.slice(0, MAX_EXTERNAL_WAREHOUSE_NOTE_LEN);
}

/**
 * Waliduje i scala udziały (ta sama paleta → suma qty, scalona notatka).
 * Σ qty musi być ≤ ilości pozycji w snapshotcie (gdy znana).
 */
export function normalizePalletSharesInput(
  lastSnapshot: unknown,
  lineKey: string,
  rawShares: {
    palletLabel: string | null | undefined;
    qty: unknown;
    note?: string | null | undefined;
  }[]
):
  | { ok: true; shares: NormalizedPalletShare[]; lineQty: number | null }
  | { ok: false; message: string } {
  const key = lineKey.trim();
  if (!key) return { ok: false, message: "Brak klucza pozycji" };

  const snapshot = parsePrunedSnapshot(lastSnapshot);
  const keys = snapshotLineKeys(snapshot);
  if (!keys.has(key)) {
    return { ok: false, message: "Pozycja nie istnieje w aktualnym ZK" };
  }

  if (!Array.isArray(rawShares)) {
    return { ok: false, message: "Nieprawidłowa lista udziałów" };
  }
  if (rawShares.length > MAX_EXTERNAL_WAREHOUSE_PALLET_SHARES_PER_LINE) {
    return {
      ok: false,
      message: `Maksymalnie ${MAX_EXTERNAL_WAREHOUSE_PALLET_SHARES_PER_LINE} palet na pozycję`,
    };
  }

  const merged = new Map<string, { qty: number; note: string | null }>();
  for (const item of rawShares) {
    const label = normalizePalletLabel(item.palletLabel);
    if (!label) {
      return { ok: false, message: "Każdy udział wymaga nazwy palety" };
    }
    const qty = normalizeShareQty(item.qty);
    if (qty == null) {
      return { ok: false, message: "Ilość na palecie musi być > 0" };
    }
    const note = normalizeLineNote(item.note);
    const prev = merged.get(label);
    if (prev) {
      merged.set(label, {
        qty: Math.round((prev.qty + qty) * 10000) / 10000,
        note: mergeShareNotes(prev.note, note),
      });
    } else {
      merged.set(label, { qty, note });
    }
  }

  const shares: NormalizedPalletShare[] = [...merged.entries()]
    .map(([palletLabel, v]) => ({
      palletLabel,
      qty: v.qty,
      note: v.note,
    }))
    .sort((a, b) =>
      a.palletLabel.localeCompare(b.palletLabel, "pl", { sensitivity: "base" })
    );

  if (shares.length > MAX_EXTERNAL_WAREHOUSE_PALLET_SHARES_PER_LINE) {
    return {
      ok: false,
      message: `Maksymalnie ${MAX_EXTERNAL_WAREHOUSE_PALLET_SHARES_PER_LINE} palet na pozycję`,
    };
  }

  const lineQty = snapshotLineQty(snapshot, key);
  if (lineQty != null) {
    const sum =
      Math.round(shares.reduce((a, s) => a + s.qty, 0) * 10000) / 10000;
    if (sum > lineQty + 1e-9) {
      return {
        ok: false,
        message: `Suma udziałów (${sum}) przekracza ilość w ZK (${lineQty})`,
      };
    }
  }

  return { ok: true, shares, lineQty };
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
