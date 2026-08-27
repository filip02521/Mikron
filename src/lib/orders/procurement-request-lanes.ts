import {
  PROCUREMENT_FLAG_SEED,
  parseProcurementFlagId,
  procurementFlagPriority,
  type ForSomeoneLineFlagFields,
  type ProcurementFlagColor,
  type ProcurementFlagDefinition,
} from "@/lib/orders/procurement-request-flag";
import { PROCUREMENT_REQUEST_LANE_COPY } from "@/lib/orders/procurement-request-lane-copy";
import type { SupplierOnVacationWindow } from "@/lib/orders/procurement-supplier-vacation";

/** Tory systemowe (bez flagi). */
export type ProcurementSystemLaneId =
  | "triage"
  | "do_zamowienia"
  | "magazyn_info"
  | "urlop";

/** Tor jednej flagi — `flag:<uuid>`. */
export type ProcurementFlagLaneId = `flag:${string}`;

export type ProcurementRequestLaneId =
  | ProcurementSystemLaneId
  | ProcurementFlagLaneId;

export type ProcurementRequestLaneVariant = "requests" | "stockOut";

/** Ścieżka grupy — unikalny groupKey (zamowienie vs via_panel vs stock_out). */
export type ProcurementRequestGroupPath = "zamowienie" | "via_panel" | "stock_out";

const FLAG_LANE_PREFIX = "flag:" as const;

/** Rank seedów przy mieszanych flagach — @deprecated używaj sort_order (Zarządzaj). */
export const FIXED_LANE_FLAG_PRIORITY: Readonly<Record<string, number>> = {
  [PROCUREMENT_FLAG_SEED.pilne]: 0,
  [PROCUREMENT_FLAG_SEED.doSprawdzenia]: 1,
  [PROCUREMENT_FLAG_SEED.czekaNaKlienta]: 2,
  [PROCUREMENT_FLAG_SEED.doWyjasnienia]: 3,
  [PROCUREMENT_FLAG_SEED.wstrzymane]: 4,
};

const SYSTEM_LANE_LABEL: Record<ProcurementSystemLaneId, string> = {
  triage: PROCUREMENT_REQUEST_LANE_COPY.triage,
  do_zamowienia: PROCUREMENT_REQUEST_LANE_COPY.doZamowienia,
  magazyn_info: PROCUREMENT_REQUEST_LANE_COPY.magazynInfo,
  urlop: PROCUREMENT_REQUEST_LANE_COPY.urlop,
};

export function isProcurementFlagLaneId(
  laneId: string
): laneId is ProcurementFlagLaneId {
  return laneId.startsWith(FLAG_LANE_PREFIX) && laneId.length > FLAG_LANE_PREFIX.length;
}

export function procurementFlagLaneId(flagId: string): ProcurementFlagLaneId {
  return `${FLAG_LANE_PREFIX}${flagId.toLowerCase()}`;
}

export function flagIdFromLaneId(laneId: ProcurementFlagLaneId): string {
  return laneId.slice(FLAG_LANE_PREFIX.length);
}

export function isProcurementSystemLaneId(
  laneId: string
): laneId is ProcurementSystemLaneId {
  return (
    laneId === "triage" ||
    laneId === "do_zamowienia" ||
    laneId === "magazyn_info" ||
    laneId === "urlop"
  );
}

export type ProcurementRequestLaneGroupFields = {
  supplierId: string;
  salesPersonId: string;
  hasUnseen: boolean;
  lines: Array<
    ForSomeoneLineFlagFields & {
      informacjaViaPanel?: boolean;
      informacjaStockOut?: boolean;
    }
  >;
};

export function procurementSystemLaneLabel(laneId: ProcurementSystemLaneId): string {
  return SYSTEM_LANE_LABEL[laneId];
}

/** @deprecated użyj procurementSystemLaneLabel / bucket.label */
export function procurementRequestLaneLabel(laneId: ProcurementRequestLaneId): string {
  if (isProcurementSystemLaneId(laneId)) return SYSTEM_LANE_LABEL[laneId];
  return PROCUREMENT_REQUEST_LANE_COPY.orphanFlag;
}

export function systemLanesForVariant(
  variant: ProcurementRequestLaneVariant
): readonly ProcurementSystemLaneId[] {
  if (variant === "stockOut") {
    return ["triage", "do_zamowienia", "urlop"] as const;
  }
  return ["triage", "do_zamowienia", "magazyn_info", "urlop"] as const;
}

/**
 * Kolejność sekcji: triage (zawsze pierwsze) → flagi → do zamówienia → magazyn → urlop.
 * Flagi wstawiane osobno w partition / lane-order.
 */
export function resolveProcurementRequestGroupPath(
  group: Pick<ProcurementRequestLaneGroupFields, "lines">,
  variant: ProcurementRequestLaneVariant
): ProcurementRequestGroupPath {
  if (variant === "stockOut") return "stock_out";
  const viaPanel = group.lines.some((l) => Boolean(l.informacjaViaPanel));
  if (viaPanel) return "via_panel";
  return "zamowienie";
}

export function procurementRequestGroupKey(
  group: Pick<ProcurementRequestLaneGroupFields, "supplierId" | "salesPersonId" | "lines">,
  variant: ProcurementRequestLaneVariant
): string {
  const path = resolveProcurementRequestGroupPath(group, variant);
  return `${group.supplierId}-${group.salesPersonId}-${path}`;
}

/**
 * Highest-wins wśród FIXED_LANE_FLAG_PRIORITY (tylko seedy).
 * @deprecated Preferuj highestFlagIdForLane (sort_order z Zarządzaj).
 */
export function highestFixedLaneFlagId(
  lines: ForSomeoneLineFlagFields[]
): string | null {
  let bestId: string | null = null;
  let bestRank = Number.POSITIVE_INFINITY;
  for (const line of lines) {
    const id = parseProcurementFlagId(line.procurementFlag);
    if (!id) continue;
    const rank = FIXED_LANE_FLAG_PRIORITY[id];
    if (rank == null) continue;
    if (rank < bestRank) {
      bestRank = rank;
      bestId = id;
    }
  }
  return bestId;
}

/** Najsilniejsza flaga w grupie → tor flagi (sort_order z Zarządzaj / defs). */
export function highestFlagIdForLane(
  lines: ForSomeoneLineFlagFields[],
  sortById?: Map<string, number> | Record<string, number>
): string | null {
  let bestId: string | null = null;
  let bestRank = Number.POSITIVE_INFINITY;
  for (const line of lines) {
    const id = parseProcurementFlagId(line.procurementFlag);
    if (!id) continue;
    const rank = procurementFlagPriority(id, sortById ?? {});
    if (rank < bestRank) {
      bestRank = rank;
      bestId = id;
    }
  }
  return bestId;
}

function groupIsViaPanel(group: ProcurementRequestLaneGroupFields): boolean {
  return group.lines.some((l) => Boolean(l.informacjaViaPanel));
}

export type AssignProcurementRequestLaneCtx = {
  variant: ProcurementRequestLaneVariant;
  suppliersOnVacationNow: Record<string, SupplierOnVacationWindow | unknown>;
  flagSortById?: Map<string, number> | Record<string, number>;
};

/**
 * Przypisanie toru — flaga → własny tor; inaczej reguły systemowe.
 * `hasUnseen` = wyłącznie sygnał serwera (nie lokalny badge).
 */
export function assignProcurementRequestLane(
  group: ProcurementRequestLaneGroupFields,
  ctx: AssignProcurementRequestLaneCtx
): ProcurementRequestLaneId {
  const flagId = highestFlagIdForLane(group.lines, ctx.flagSortById);
  if (flagId) {
    return procurementFlagLaneId(flagId);
  }

  if (group.supplierId && ctx.suppliersOnVacationNow[group.supplierId]) {
    return "urlop";
  }

  if (ctx.variant === "requests" && groupIsViaPanel(group)) {
    return "magazyn_info";
  }

  if (group.hasUnseen) {
    return "triage";
  }

  return "do_zamowienia";
}

export type ProcurementRequestLaneBucket<T extends ProcurementRequestLaneGroupFields> = {
  laneId: ProcurementRequestLaneId;
  label: string;
  /** Kolor tła toru — z definicji flagi albo ton systemowy. */
  color: ProcurementFlagColor | "indigo";
  groups: T[];
};

function resolveFlagLaneMeta(
  flagId: string,
  definitions: ProcurementFlagDefinition[]
): { label: string; color: ProcurementFlagColor } {
  const key = flagId.toLowerCase();
  const def = definitions.find((d) => d.id.toLowerCase() === key);
  if (def) {
    return { label: def.label, color: def.color };
  }
  return {
    label: PROCUREMENT_REQUEST_LANE_COPY.orphanFlag,
    color: "slate",
  };
}

function systemLaneColor(laneId: ProcurementSystemLaneId): ProcurementFlagColor | "indigo" {
  switch (laneId) {
    case "triage":
      return "indigo";
    case "do_zamowienia":
      return "emerald";
    case "magazyn_info":
      return "sky";
    case "urlop":
      return "amber";
  }
}

function bucketMetaForLane(
  laneId: ProcurementRequestLaneId,
  definitions: ProcurementFlagDefinition[]
): { label: string; color: ProcurementFlagColor | "indigo" } {
  if (isProcurementSystemLaneId(laneId)) {
    return { label: SYSTEM_LANE_LABEL[laneId], color: systemLaneColor(laneId) };
  }
  return resolveFlagLaneMeta(flagIdFromLaneId(laneId), definitions);
}

function defaultLaneOrderInline(
  definitions: ProcurementFlagDefinition[],
  variant: ProcurementRequestLaneVariant
): ProcurementRequestLaneId[] {
  const allowed = new Set(systemLanesForVariant(variant));
  const flags = [...definitions]
    .filter((d) => d.isActive)
    .sort((a, b) => a.sortOrder - b.sortOrder || a.label.localeCompare(b.label, "pl"))
    .map((d) => procurementFlagLaneId(d.id));
  const order: ProcurementRequestLaneId[] = [];
  if (allowed.has("triage")) order.push("triage");
  order.push(...flags);
  for (const id of ["do_zamowienia", "magazyn_info", "urlop"] as const) {
    if (allowed.has(id)) order.push(id);
  }
  return order;
}

/** Partition — każda grupa w dokładnie jednym torze; puste tory (także systemowe) pomijane. */
export function partitionForSomeoneGroups<T extends ProcurementRequestLaneGroupFields>(
  groups: T[],
  ctx: AssignProcurementRequestLaneCtx & {
    flagDefinitions?: ProcurementFlagDefinition[];
    /** Już znormalizowana kolejność (system + flag:uuid). */
    laneOrder?: readonly ProcurementRequestLaneId[] | null;
  }
): ProcurementRequestLaneBucket<T>[] {
  const definitions = ctx.flagDefinitions ?? [];
  const allowedSystem = new Set(systemLanesForVariant(ctx.variant));
  const buckets = new Map<ProcurementRequestLaneId, T[]>();

  for (const group of groups) {
    let laneId = assignProcurementRequestLane(group, ctx);
    if (isProcurementSystemLaneId(laneId) && !allowedSystem.has(laneId)) {
      laneId = "do_zamowienia";
    }
    const list = buckets.get(laneId);
    if (list) list.push(group);
    else buckets.set(laneId, [group]);
  }

  const order =
    ctx.laneOrder && ctx.laneOrder.length > 0
      ? [...ctx.laneOrder]
      : defaultLaneOrderInline(definitions, ctx.variant);

  const result: ProcurementRequestLaneBucket<T>[] = [];
  const emitted = new Set<string>();

  for (const laneId of order) {
    if (isProcurementSystemLaneId(laneId) && !allowedSystem.has(laneId)) continue;
    const laneGroups = buckets.get(laneId);
    if (!laneGroups?.length) continue;
    const meta = bucketMetaForLane(laneId, definitions);
    result.push({
      laneId,
      label: meta.label,
      color: meta.color,
      groups: laneGroups,
    });
    emitted.add(laneId);
  }

  /** Orphan / brak w order — na końcu. */
  for (const [laneId, laneGroups] of buckets) {
    if (emitted.has(laneId) || !laneGroups.length) continue;
    if (isProcurementSystemLaneId(laneId) && !allowedSystem.has(laneId)) continue;
    const meta = bucketMetaForLane(laneId, definitions);
    result.push({
      laneId,
      label: meta.label,
      color: meta.color,
      groups: laneGroups,
    });
  }

  return result;
}

export function procurementLaneAnchorId(
  variant: ProcurementRequestLaneVariant,
  laneId: ProcurementRequestLaneId
): string {
  const prefix = variant === "stockOut" ? "brak-tor" : "prosby-tor";
  if (isProcurementFlagLaneId(laneId)) {
    return `${prefix}-flag-${flagIdFromLaneId(laneId)}`;
  }
  return `${prefix}-${laneId.replace(/_/g, "-")}`;
}
