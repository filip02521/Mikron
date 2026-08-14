import { createAdminClient } from "@/lib/supabase/admin";
import type { ZdEstimateSnapshotHostKind } from "@/lib/subiekt/config";

export type ZdEstimateSnapshotScopeMode = "grupa" | "cecha";

export type ZdEstimateOrderSnapshotRow = {
  id: string;
  dokId: number;
  dokNrPelny: string;
  linkedAt: string;
  linkedBy: string | null;
  supplierKhId: number | null;
  grtId: number | null;
  cechaId: number | null;
  scopeMode: ZdEstimateSnapshotScopeMode | null;
  hostKind: ZdEstimateSnapshotHostKind;
  eligibleForHistory: boolean;
};

export type ZdEstimateOrderSnapshotLineRow = {
  id: string;
  snapshotId: string;
  twId: number;
  twSymbol: string | null;
  twNazwa: string;
  /** Zamówione sztuki (przy linku: jednostki ZD × opakowanie). */
  qty: number;
  celAtLink: number | null;
  deltaAtLink: number | null;
  linkedAt: string;
  dokId: number;
  dokNrPelny: string;
};

export type ZdEstimateHistoryScope =
  | { mode: "grupa"; grtId: number }
  | { mode: "cecha"; cechaId: number };

type SnapshotDb = {
  id: string;
  dok_id: number;
  dok_nr_pelny: string | null;
  linked_at: string;
  linked_by: string | null;
  supplier_kh_id: number | null;
  grt_id: number | null;
  cecha_id?: number | null;
  scope_mode?: string | null;
  host_kind?: string | null;
  eligible_for_history?: boolean | null;
};

type LineDb = {
  id: string;
  snapshot_id: string;
  tw_id: number;
  tw_symbol: string | null;
  tw_nazwa: string | null;
  qty: number | string;
  cel_at_link: number | string | null;
  delta_at_link: number | string | null;
};

const SNAPSHOT_SELECT =
  "id, dok_id, dok_nr_pelny, linked_at, linked_by, supplier_kh_id, grt_id, cecha_id, scope_mode, host_kind, eligible_for_history";

function asNum(value: unknown, fallback = 0): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const n = Number(value.replace(",", "."));
    if (Number.isFinite(n)) return n;
  }
  return fallback;
}

function finiteOrNull(value: unknown): number | null {
  if (value == null) return null;
  const n = asNum(value, NaN);
  return Number.isFinite(n) ? n : null;
}

function parseScopeMode(
  value: string | null | undefined
): ZdEstimateSnapshotScopeMode | null {
  if (value === "grupa" || value === "cecha") return value;
  return null;
}

function parseHostKind(
  value: string | null | undefined
): ZdEstimateSnapshotHostKind {
  return value === "live" ? "live" : "orders_test";
}

export function mapZdEstimateOrderSnapshot(row: SnapshotDb): ZdEstimateOrderSnapshotRow {
  return {
    id: row.id,
    dokId: Number(row.dok_id),
    dokNrPelny: (row.dok_nr_pelny ?? "").trim(),
    linkedAt: row.linked_at,
    linkedBy: row.linked_by,
    supplierKhId: row.supplier_kh_id != null ? Number(row.supplier_kh_id) : null,
    grtId: row.grt_id != null ? Number(row.grt_id) : null,
    cechaId: row.cecha_id != null ? Number(row.cecha_id) : null,
    scopeMode: parseScopeMode(row.scope_mode),
    hostKind: parseHostKind(row.host_kind),
    eligibleForHistory: row.eligible_for_history !== false,
  };
}

export type UpsertZdEstimateOrderSnapshotInput = {
  dokId: number;
  dokNrPelny: string;
  linkedBy: string | null;
  supplierKhId?: number | null;
  grtId?: number | null;
  cechaId?: number | null;
  scopeMode?: ZdEstimateSnapshotScopeMode | null;
  hostKind: ZdEstimateSnapshotHostKind;
  eligibleForHistory?: boolean;
  lines: Array<{
    twId: number;
    twSymbol?: string | null;
    twNazwa?: string | null;
    /** Sztuki. */
    qty: number;
    celAtLink?: number | null;
    deltaAtLink?: number | null;
    ratioAtLink?: number | null;
  }>;
};

function normalizeUpsertLines(input: UpsertZdEstimateOrderSnapshotInput["lines"]) {
  return input
    .map((l) => ({
      twId: Math.trunc(l.twId),
      twSymbol: l.twSymbol?.trim() || null,
      twNazwa: (l.twNazwa ?? "").trim() || "—",
      qty: Math.max(0, asNum(l.qty)),
      celAtLink:
        l.celAtLink != null && Number.isFinite(Number(l.celAtLink))
          ? Number(l.celAtLink)
          : null,
      deltaAtLink:
        l.deltaAtLink != null && Number.isFinite(Number(l.deltaAtLink))
          ? Number(l.deltaAtLink)
          : null,
      ratioAtLink:
        l.ratioAtLink != null && Number.isFinite(Number(l.ratioAtLink))
          ? Number(l.ratioAtLink)
          : null,
    }))
    .filter((l) => l.twId > 0);
}

function linesFingerprint(
  lines: ReturnType<typeof normalizeUpsertLines>
): string {
  return lines
    .map((l) => `${l.twId}:${l.qty}`)
    .sort()
    .join("|");
}

function headerMetaFingerprint(input: {
  supplierKhId: number | null;
  grtId: number | null;
  cechaId: number | null;
  scopeMode: ZdEstimateSnapshotScopeMode | null;
  hostKind: ZdEstimateSnapshotHostKind;
  eligibleForHistory: boolean;
}): string {
  return [
    input.hostKind,
    input.supplierKhId ?? "",
    input.scopeMode ?? "",
    input.cechaId ?? "",
    input.grtId ?? "",
    input.eligibleForHistory ? "1" : "0",
  ].join("|");
}

/**
 * Idempotentny zapis snapshotu po dok_id.
 * Linie: upsert po (snapshot_id, tw_id), potem usunięcie orphanów.
 * Identyczne linie+metadane → bez bumpa linked_at.
 */
export async function upsertZdEstimateOrderSnapshot(
  input: UpsertZdEstimateOrderSnapshotInput
): Promise<{
  snapshot: ZdEstimateOrderSnapshotRow;
  lineCount: number;
}> {
  const dokId = Math.trunc(input.dokId);
  if (!(dokId > 0)) throw new Error("Nieprawidłowe dok_Id.");

  const lines = normalizeUpsertLines(input.lines);
  if (lines.length === 0) {
    throw new Error("ZD nie ma pozycji towarowych do zapisania.");
  }

  const scopeMode = input.scopeMode ?? null;
  if (scopeMode !== "grupa" && scopeMode !== "cecha") {
    throw new Error(
      "Zapis historii wymaga scope_mode (grupa|cecha) — legacy NULL tylko przy odczycie."
    );
  }

  const supabase = createAdminClient();
  const now = new Date().toISOString();
  if (input.hostKind !== "live" && input.hostKind !== "orders_test") {
    throw new Error("Zapis historii wymaga host_kind (live | orders_test).");
  }
  const hostKind = input.hostKind;
  const cechaId =
    scopeMode === "cecha" && input.cechaId != null && input.cechaId > 0
      ? Math.trunc(input.cechaId)
      : null;
  const grtId =
    scopeMode === "grupa" && input.grtId != null && input.grtId > 0
      ? Math.trunc(input.grtId)
      : null;
  if (scopeMode === "cecha" && !(cechaId != null && cechaId > 0)) {
    throw new Error("Zapis historii (cecha) wymaga cecha_id.");
  }
  if (scopeMode === "grupa" && !(grtId != null && grtId > 0)) {
    throw new Error("Zapis historii (grupa) wymaga grt_id.");
  }
  const eligibleForHistory = input.eligibleForHistory !== false;

  const { data: existingSnap } = await supabase
    .from("zd_estimate_order_snapshots")
    .select(SNAPSHOT_SELECT)
    .eq("dok_id", dokId)
    .eq("host_kind", hostKind)
    .maybeSingle();

  let linkedAt = now;
  if (existingSnap?.id) {
    const existing = existingSnap as SnapshotDb;
    const { data: existingLines } = await supabase
      .from("zd_estimate_order_snapshot_lines")
      .select("tw_id, qty")
      .eq("snapshot_id", existing.id);
    const prevFp = linesFingerprint(
      (existingLines ?? []).map((r) => ({
        twId: Math.trunc(Number(r.tw_id)),
        twSymbol: null,
        twNazwa: "—",
        qty: asNum(r.qty),
        celAtLink: null,
        deltaAtLink: null,
        ratioAtLink: null,
      }))
    );
    const nextFp = linesFingerprint(lines);
    const prevHeader = headerMetaFingerprint({
      supplierKhId:
        existing.supplier_kh_id != null
          ? Number(existing.supplier_kh_id)
          : null,
      grtId: existing.grt_id != null ? Number(existing.grt_id) : null,
      cechaId: existing.cecha_id != null ? Number(existing.cecha_id) : null,
      scopeMode: parseScopeMode(existing.scope_mode),
      hostKind: parseHostKind(existing.host_kind),
      eligibleForHistory: existing.eligible_for_history !== false,
    });
    const nextHeader = headerMetaFingerprint({
      supplierKhId: input.supplierKhId ?? null,
      grtId,
      cechaId,
      scopeMode,
      hostKind,
      eligibleForHistory,
    });
    // Identyczne linie + metadane → bez bumpa linked_at (zegar 7 dni).
    // Zmiana scope/eligible/kh → bump, żeby cut nie wyglądał „stary” przy nowym kontekście.
    if (
      prevFp === nextFp &&
      prevHeader === nextHeader &&
      existing.linked_at
    ) {
      linkedAt = existing.linked_at;
    }
  }

  const { data: snapRow, error: snapErr } = await supabase
    .from("zd_estimate_order_snapshots")
    .upsert(
      {
        dok_id: dokId,
        dok_nr_pelny: input.dokNrPelny.trim().slice(0, 120),
        linked_at: linkedAt,
        linked_by: input.linkedBy,
        supplier_kh_id: input.supplierKhId ?? null,
        grt_id: grtId,
        cecha_id: cechaId,
        scope_mode: scopeMode,
        host_kind: hostKind,
        eligible_for_history: eligibleForHistory,
      },
      { onConflict: "host_kind,dok_id" }
    )
    .select(SNAPSHOT_SELECT)
    .single();

  if (snapErr) throw new Error(snapErr.message);
  const snapshot = mapZdEstimateOrderSnapshot(snapRow as SnapshotDb);

  const { error: upsertLinesErr } = await supabase
    .from("zd_estimate_order_snapshot_lines")
    .upsert(
      lines.map((l) => ({
        snapshot_id: snapshot.id,
        tw_id: l.twId,
        tw_symbol: l.twSymbol,
        tw_nazwa: l.twNazwa,
        qty: l.qty,
        cel_at_link: l.celAtLink,
        delta_at_link: l.deltaAtLink,
        ratio_at_link: l.ratioAtLink,
      })),
      { onConflict: "snapshot_id,tw_id" }
    );
  if (upsertLinesErr) throw new Error(upsertLinesErr.message);

  const keepTwIds = new Set(lines.map((l) => l.twId));
  const { data: existingLines, error: existingErr } = await supabase
    .from("zd_estimate_order_snapshot_lines")
    .select("tw_id")
    .eq("snapshot_id", snapshot.id);
  if (existingErr) throw new Error(existingErr.message);

  const orphanTwIds = [
    ...new Set(
      (existingLines ?? [])
        .map((r) => Math.trunc(Number(r.tw_id)))
        .filter((id) => id > 0 && !keepTwIds.has(id))
    ),
  ];
  if (orphanTwIds.length > 0) {
    const { error: delErr } = await supabase
      .from("zd_estimate_order_snapshot_lines")
      .delete()
      .eq("snapshot_id", snapshot.id)
      .in("tw_id", orphanTwIds);
    if (delErr) throw new Error(delErr.message);
  }

  return { snapshot, lineCount: lines.length };
}

export async function fetchRecentZdEstimateOrderSnapshots(limit = 20): Promise<
  ZdEstimateOrderSnapshotRow[]
> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("zd_estimate_order_snapshots")
    .select(SNAPSHOT_SELECT)
    .order("linked_at", { ascending: false })
    .limit(Math.min(100, Math.max(1, limit)));
  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => mapZdEstimateOrderSnapshot(r as SnapshotDb));
}

/**
 * Najnowsza linia snapshotu per tw_Id — bez filtra dostawcy (legacy / admin).
 * Preferuj {@link fetchLatestSnapshotHistoryByTwIds} w szacunku.
 */
export async function fetchLatestSnapshotLinesByTwIds(
  twIds: readonly number[]
): Promise<Map<number, ZdEstimateOrderSnapshotLineRow>> {
  return fetchLatestSnapshotHistoryByTwIds(twIds, null);
}

/**
 * Czy nagłówek snapshotu pasuje do filtrów Policz (kh + host + scope / legacy).
 * Export pod testy macierzy akceptacji.
 */
export function snapshotHeaderMatchesHistoryFilters(
  snap: {
    supplier_kh_id?: number | null;
    grt_id?: number | null;
    cecha_id?: number | null;
    scope_mode?: string | null;
    host_kind?: string | null;
    eligible_for_history?: boolean | null;
  },
  filters: {
    supplierKhIds: readonly number[];
    scope: ZdEstimateHistoryScope;
    hostKind: ZdEstimateSnapshotHostKind;
  }
): boolean {
  if (snap.eligible_for_history === false) return false;
  if (parseHostKind(snap.host_kind) !== filters.hostKind) return false;
  const kh =
    snap.supplier_kh_id != null ? Math.trunc(Number(snap.supplier_kh_id)) : 0;
  if (!(kh > 0) || !filters.supplierKhIds.includes(kh)) return false;

  const scopeMode = parseScopeMode(snap.scope_mode);
  if (scopeMode == null) {
    // Legacy: wystarczy kh + host.
    return true;
  }
  if (filters.scope.mode === "cecha") {
    return (
      scopeMode === "cecha" &&
      Number(snap.cecha_id) === filters.scope.cechaId
    );
  }
  return (
    scopeMode === "grupa" && Number(snap.grt_id) === filters.scope.grtId
  );
}

/** PostgREST `.or` dla foreign table — scope match XOR legacy NULL. */
export function snapshotHistoryScopeOrFilter(
  scope: ZdEstimateHistoryScope
): string {
  if (scope.mode === "cecha") {
    const id = Math.trunc(scope.cechaId);
    return `and(scope_mode.eq.cecha,cecha_id.eq.${id}),scope_mode.is.null`;
  }
  const id = Math.trunc(scope.grtId);
  return `and(scope_mode.eq.grupa,grt_id.eq.${id}),scope_mode.is.null`;
}

/**
 * Historia do Policz: host + kh (+ aliasy) + scope (z legacy fallback).
 * `filters = null` → tylko tw_id (legacy helper).
 */
export async function fetchLatestSnapshotHistoryByTwIds(
  twIds: readonly number[],
  filters: {
    supplierKhIds: readonly number[];
    scope: ZdEstimateHistoryScope;
    hostKind: ZdEstimateSnapshotHostKind;
  } | null
): Promise<Map<number, ZdEstimateOrderSnapshotLineRow>> {
  const ids = [
    ...new Set(twIds.map((id) => Math.trunc(id)).filter((id) => id > 0)),
  ];
  const map = new Map<number, ZdEstimateOrderSnapshotLineRow>();
  if (ids.length === 0) return map;

  const khIds = filters
    ? [
        ...new Set(
          filters.supplierKhIds
            .map((id) => Math.trunc(Number(id)))
            .filter((id) => id > 0)
        ),
      ]
    : [];
  if (filters && khIds.length === 0) return map;

  const supabase = createAdminClient();
  let query = supabase
    .from("zd_estimate_order_snapshot_lines")
    .select(
      `
      id,
      snapshot_id,
      tw_id,
      tw_symbol,
      tw_nazwa,
      qty,
      cel_at_link,
      delta_at_link,
      zd_estimate_order_snapshots!inner (
        dok_id,
        dok_nr_pelny,
        linked_at,
        supplier_kh_id,
        grt_id,
        cecha_id,
        scope_mode,
        host_kind,
        eligible_for_history
      )
    `
    )
    .in("tw_id", ids);

  if (filters) {
    query = query
      .eq("zd_estimate_order_snapshots.host_kind", filters.hostKind)
      .in("zd_estimate_order_snapshots.supplier_kh_id", khIds)
      .eq("zd_estimate_order_snapshots.eligible_for_history", true)
      .or(snapshotHistoryScopeOrFilter(filters.scope), {
        foreignTable: "zd_estimate_order_snapshots",
      });
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);

  type JoinedHeader = {
    dok_id: number;
    dok_nr_pelny: string | null;
    linked_at: string;
    supplier_kh_id?: number | null;
    grt_id?: number | null;
    cecha_id?: number | null;
    scope_mode?: string | null;
    host_kind?: string | null;
    eligible_for_history?: boolean | null;
  };

  type Joined = LineDb & {
    zd_estimate_order_snapshots: JoinedHeader | JoinedHeader[];
  };

  const parsed: ZdEstimateOrderSnapshotLineRow[] = [];
  for (const raw of data ?? []) {
    const row = raw as unknown as Joined;
    const snapRaw = row.zd_estimate_order_snapshots;
    const snap = Array.isArray(snapRaw) ? snapRaw[0] : snapRaw;
    if (!snap) continue;
    if (filters) {
      if (!snapshotHeaderMatchesHistoryFilters(snap, filters)) continue;
    } else if (snap.eligible_for_history === false) {
      continue;
    }
    parsed.push({
      id: row.id,
      snapshotId: row.snapshot_id,
      twId: Number(row.tw_id),
      twSymbol: row.tw_symbol?.trim() || null,
      twNazwa: (row.tw_nazwa ?? "").trim() || "—",
      qty: asNum(row.qty),
      celAtLink: finiteOrNull(row.cel_at_link),
      deltaAtLink: finiteOrNull(row.delta_at_link),
      linkedAt: snap.linked_at,
      dokId: Number(snap.dok_id),
      dokNrPelny: (snap.dok_nr_pelny ?? "").trim(),
    });
  }

  parsed.sort(
    (a, b) =>
      Date.parse(b.linkedAt) - Date.parse(a.linkedAt) || b.dokId - a.dokId
  );
  for (const row of parsed) {
    if (!map.has(row.twId)) map.set(row.twId, row);
  }

  return map;
}

export async function fetchZdEstimateOrderSnapshotLines(
  snapshotId: string
): Promise<ZdEstimateOrderSnapshotLineRow[]> {
  const id = snapshotId.trim();
  if (!id) return [];
  const supabase = createAdminClient();
  const { data: header, error: headerError } = await supabase
    .from("zd_estimate_order_snapshots")
    .select(SNAPSHOT_SELECT)
    .eq("id", id)
    .maybeSingle();
  if (headerError) throw new Error(headerError.message);
  if (!header) return [];
  const snap = mapZdEstimateOrderSnapshot(header as SnapshotDb);

  const { data, error } = await supabase
    .from("zd_estimate_order_snapshot_lines")
    .select(
      "id, snapshot_id, tw_id, tw_symbol, tw_nazwa, qty, cel_at_link, delta_at_link"
    )
    .eq("snapshot_id", id)
    .order("tw_symbol", { ascending: true });
  if (error) throw new Error(error.message);

  return (data ?? []).map((row) => {
    const r = row as LineDb;
    return {
      id: r.id,
      snapshotId: r.snapshot_id,
      twId: Number(r.tw_id),
      twSymbol: r.tw_symbol?.trim() || null,
      twNazwa: (r.tw_nazwa ?? "").trim() || "—",
      qty: asNum(r.qty),
      celAtLink: finiteOrNull(r.cel_at_link),
      deltaAtLink: finiteOrNull(r.delta_at_link),
      linkedAt: snap.linkedAt,
      dokId: snap.dokId,
      dokNrPelny: snap.dokNrPelny,
    };
  });
}

export async function updateZdEstimateSnapshotEligibleForHistory(
  snapshotId: string,
  eligible: boolean
): Promise<void> {
  const id = snapshotId.trim();
  if (!id) throw new Error("Brak snapshotId.");
  const supabase = createAdminClient();
  const { error } = await supabase
    .from("zd_estimate_order_snapshots")
    .update({ eligible_for_history: eligible === true })
    .eq("id", id);
  if (error) throw new Error(error.message);
}

