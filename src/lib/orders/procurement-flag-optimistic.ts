import {
  parseProcurementFlagId,
  type ForSomeoneLineFlagFields,
} from "@/lib/orders/procurement-request-flag";

/** Optymistyczny zapis flagi na liniach prośby (order id → flaga + opis). */
export type ProcurementFlagLinePatch = {
  flag: string | null;
  note: string | null;
};

export type ProcurementFlagPatchMap = ReadonlyMap<string, ProcurementFlagLinePatch>;

function flagValuesEqual(
  a: string | null | undefined,
  b: string | null | undefined
): boolean {
  return parseProcurementFlagId(a) === parseProcurementFlagId(b);
}

function noteValuesEqual(
  a: string | null | undefined,
  b: string | null | undefined
): boolean {
  return (a?.trim() || null) === (b?.trim() || null);
}

/**
 * Nakłada lokalne patche flag na grupy — tor (`assignProcurementRequestLane`)
 * przelicza się od razu, bez czekania na refresh propsów z serwera.
 */
export function applyProcurementFlagPatchesToGroups<
  T extends { lines: ForSomeoneLineFlagFields[] },
>(groups: T[], patches: ProcurementFlagPatchMap): T[] {
  if (!patches.size) return groups;

  let any = false;
  const next = groups.map((group) => {
    let linesChanged = false;
    const lines = group.lines.map((line) => {
      const patch = patches.get(line.id);
      if (!patch) return line;
      linesChanged = true;
      any = true;
      return {
        ...line,
        procurementFlag: patch.flag,
        procurementFlagNote: patch.note,
      };
    });
    if (!linesChanged) return group;
    return { ...group, lines };
  });

  return any ? next : groups;
}

/** Usuwa patche już zsynchronizowane z danymi serwera (po refresh / revalidate). */
export function pruneSyncedProcurementFlagPatches<
  T extends { lines: ForSomeoneLineFlagFields[] },
>(groups: T[], patches: ProcurementFlagPatchMap): Map<string, ProcurementFlagLinePatch> {
  if (!patches.size) return new Map();

  const byId = new Map<string, ForSomeoneLineFlagFields>();
  for (const group of groups) {
    for (const line of group.lines) {
      byId.set(line.id, line);
    }
  }

  const next = new Map<string, ProcurementFlagLinePatch>();
  for (const [orderId, patch] of patches) {
    const line = byId.get(orderId);
    if (!line) continue; // prośba zniknęła — drop
    if (
      flagValuesEqual(line.procurementFlag, patch.flag) &&
      noteValuesEqual(line.procurementFlagNote, patch.note)
    ) {
      continue; // serwer dogonił
    }
    next.set(orderId, patch);
  }
  return next;
}

export function buildProcurementFlagPatchesForOrderIds(
  orderIds: string[],
  flag: string | null,
  note: string | null = null
): Map<string, ProcurementFlagLinePatch> {
  const map = new Map<string, ProcurementFlagLinePatch>();
  const normalizedFlag = flag == null ? null : parseProcurementFlagId(flag);
  if (flag != null && flag !== "" && normalizedFlag == null) {
    // Nie buduj patchy z nieparsowalną flagą — inaczej optymistycznie „czyścimy”.
    return map;
  }
  const normalizedNote = note?.trim() || null;
  for (const id of orderIds) {
    map.set(id, { flag: normalizedFlag, note: normalizedNote });
  }
  return map;
}

export function mergeProcurementFlagPatchMaps(
  base: ProcurementFlagPatchMap,
  incoming: ProcurementFlagPatchMap
): Map<string, ProcurementFlagLinePatch> {
  const next = new Map(base);
  for (const [id, patch] of incoming) {
    next.set(id, patch);
  }
  return next;
}

export function omitProcurementFlagPatches(
  base: ProcurementFlagPatchMap,
  orderIds: Iterable<string>
): Map<string, ProcurementFlagLinePatch> {
  const next = new Map(base);
  for (const id of orderIds) {
    next.delete(id);
  }
  return next;
}

/** Klient: po Cofnij wyrzuć lokalne patche — serwer wraca do poprzedniej flagi. */
let flagOptimisticEpoch = 0;
const flagOptimisticListeners = new Set<() => void>();

export function subscribeProcurementFlagOptimisticInvalidate(
  onStoreChange: () => void
) {
  flagOptimisticListeners.add(onStoreChange);
  return () => {
    flagOptimisticListeners.delete(onStoreChange);
  };
}

export function getProcurementFlagOptimisticEpoch(): number {
  return flagOptimisticEpoch;
}

export function getProcurementFlagOptimisticEpochServerSnapshot(): number {
  return 0;
}

export function invalidateProcurementFlagOptimistic() {
  flagOptimisticEpoch += 1;
  flagOptimisticListeners.forEach((l) => l());
}
