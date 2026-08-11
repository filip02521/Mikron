import type { ProcurementFlagDefinition } from "@/lib/orders/procurement-request-flag";
import {
  flagIdFromLaneId,
  isProcurementFlagLaneId,
  isProcurementSystemLaneId,
  procurementFlagLaneId,
  type ProcurementRequestLaneId,
  type ProcurementSystemLaneId,
} from "@/lib/orders/procurement-request-lanes";

/** Klucz w app_settings (JSONB array stringów). */
export const PROCUREMENT_LANE_ORDER_SETTING_KEY = "procurement_request_lane_order";

/** Zawsze pełny zestaw torów systemowych (kolejność zapisuje sekcja Prośby). */
const ALL_SYSTEM_LANES: readonly ProcurementSystemLaneId[] = [
  "triage",
  "do_zamowienia",
  "magazyn_info",
  "urlop",
] as const;

const DEFAULT_SYSTEM_TAIL: readonly ProcurementSystemLaneId[] = [
  "do_zamowienia",
  "magazyn_info",
  "urlop",
] as const;

/** Domyślna kolejność: triage → flagi (sort_order) → do zamówienia → magazyn → urlop. */
export function defaultProcurementLaneOrder(
  definitions: ProcurementFlagDefinition[]
): ProcurementRequestLaneId[] {
  const flags = [...definitions]
    .filter((d) => d.isActive)
    .sort((a, b) => a.sortOrder - b.sortOrder || a.label.localeCompare(b.label, "pl"))
    .map((d) => procurementFlagLaneId(d.id));

  return ["triage", ...flags, ...DEFAULT_SYSTEM_TAIL];
}

function parseSavedLaneOrder(raw: unknown): string[] | null {
  if (!Array.isArray(raw)) return null;
  const out: string[] = [];
  for (const item of raw) {
    if (typeof item !== "string" || !item.trim()) continue;
    out.push(item.trim().toLowerCase());
  }
  return out.length ? out : null;
}

function coerceLaneId(raw: string): ProcurementRequestLaneId | null {
  if (isProcurementSystemLaneId(raw)) return raw;
  if (isProcurementFlagLaneId(raw)) return raw;
  // legacy / bare uuid
  if (/^[0-9a-f-]{36}$/i.test(raw)) return procurementFlagLaneId(raw);
  return null;
}

function systemTailStartIndex(order: readonly ProcurementRequestLaneId[]): number {
  let i = order.length;
  while (i > 0) {
    const id = order[i - 1]!;
    if (id === "do_zamowienia" || id === "magazyn_info" || id === "urlop") {
      i -= 1;
      continue;
    }
    break;
  }
  return i;
}

/** Wstaw brakujący tor systemowy względem DEFAULT_SYSTEM_TAIL / triage. */
function insertMissingSystemLane(
  order: ProcurementRequestLaneId[],
  missing: ProcurementSystemLaneId
): void {
  if (missing === "triage") {
    order.unshift("triage");
    return;
  }
  const idx = DEFAULT_SYSTEM_TAIL.indexOf(missing);
  if (idx < 0) {
    order.push(missing);
    return;
  }
  // Najpierw po poprzedniku z ogona (zachowuje custom urlop na początku).
  for (let j = idx - 1; j >= 0; j--) {
    const earlier = DEFAULT_SYSTEM_TAIL[j]!;
    const at = order.indexOf(earlier);
    if (at >= 0) {
      order.splice(at + 1, 0, missing);
      return;
    }
  }
  for (let j = idx + 1; j < DEFAULT_SYSTEM_TAIL.length; j++) {
    const later = DEFAULT_SYSTEM_TAIL[j]!;
    const at = order.indexOf(later);
    if (at >= 0) {
      order.splice(at, 0, missing);
      return;
    }
  }
  order.splice(systemTailStartIndex(order), 0, missing);
}

/**
 * Scala zapisany porządek z aktualnymi flagami.
 * Zawsze pełny zestaw torów systemowych (w tym magazyn_info) — kolejność jest
 * współdzielona w prefsach panelu (Prośby); Brak na stanie nie renderuje torów.
 * Nieznane id pomija; brakujące dorzuca w domyślnych miejscach.
 */
export function normalizeProcurementLaneOrder(
  saved: unknown,
  definitions: ProcurementFlagDefinition[]
): ProcurementRequestLaneId[] {
  const allowedSystem = new Set<string>(ALL_SYSTEM_LANES);
  const activeFlagIds = new Set(
    definitions.filter((d) => d.isActive).map((d) => d.id.toLowerCase())
  );
  const defaults = defaultProcurementLaneOrder(definitions);
  const parsed = parseSavedLaneOrder(saved);
  if (!parsed) return defaults;

  const seen = new Set<string>();
  const result: ProcurementRequestLaneId[] = [];

  for (const raw of parsed) {
    const id = coerceLaneId(raw);
    if (!id) continue;
    if (isProcurementSystemLaneId(id)) {
      if (!allowedSystem.has(id)) continue;
      if (seen.has(id)) continue;
      seen.add(id);
      result.push(id);
      continue;
    }
    const fid = flagIdFromLaneId(id);
    if (!activeFlagIds.has(fid)) continue;
    if (seen.has(id)) continue;
    seen.add(id);
    result.push(id);
  }

  for (const id of defaults) {
    if (seen.has(id)) continue;
    seen.add(id);
    if (isProcurementFlagLaneId(id)) {
      const at = systemTailStartIndex(result);
      result.splice(at, 0, id);
      continue;
    }
    if (isProcurementSystemLaneId(id)) {
      insertMissingSystemLane(result, id);
      continue;
    }
    result.push(id);
  }

  return result;
}

/** Zamień tor z sąsiadem wśród aktualnie widocznych torów. */
export function moveVisibleLaneInOrder(
  order: readonly ProcurementRequestLaneId[],
  laneId: ProcurementRequestLaneId,
  dir: -1 | 1,
  visibleLaneIds: readonly ProcurementRequestLaneId[]
): ProcurementRequestLaneId[] | null {
  const visIdx = visibleLaneIds.indexOf(laneId);
  if (visIdx < 0) return null;
  const neighborId = visibleLaneIds[visIdx + dir];
  if (!neighborId) return null;

  const i = order.indexOf(laneId);
  const j = order.indexOf(neighborId);
  if (i < 0 || j < 0 || i === j) return null;

  const next = [...order];
  next[i] = neighborId;
  next[j] = laneId;
  return next;
}

/**
 * Po ↑↓ w Zarządzaj: przepisz sekwencję flag:* w laneOrder
 * według nowej kolejności aktywnych flag (tory systemowe bez zmian pozycji względnych).
 */
export function replaceActiveFlagSequenceInLaneOrder(
  order: readonly ProcurementRequestLaneId[],
  newActiveFlagIds: readonly string[]
): ProcurementRequestLaneId[] {
  const newFlagLanes = newActiveFlagIds.map((id) => procurementFlagLaneId(id));
  const used = new Set<string>();
  let fi = 0;
  const next: ProcurementRequestLaneId[] = [];

  for (const id of order) {
    if (isProcurementFlagLaneId(id)) {
      const replacement = newFlagLanes[fi];
      if (replacement) {
        next.push(replacement);
        used.add(flagIdFromLaneId(replacement));
        fi += 1;
      }
      continue;
    }
    next.push(id);
  }

  for (const lane of newFlagLanes) {
    if (used.has(flagIdFromLaneId(lane))) continue;
    const at = systemTailStartIndex(next);
    next.splice(at, 0, lane);
    used.add(flagIdFromLaneId(lane));
  }

  return next;
}

export function serializeProcurementLaneOrder(
  order: readonly ProcurementRequestLaneId[]
): string[] {
  return order.map((id) => id);
}

export function canMoveVisibleLane(
  visibleLaneIds: readonly ProcurementRequestLaneId[],
  laneId: ProcurementRequestLaneId,
  dir: -1 | 1
): boolean {
  const idx = visibleLaneIds.indexOf(laneId);
  if (idx < 0) return false;
  const neighbor = visibleLaneIds[idx + dir];
  return Boolean(neighbor);
}
