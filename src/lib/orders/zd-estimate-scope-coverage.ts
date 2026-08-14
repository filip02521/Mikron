/**
 * Dostawcy z kolejki Dziś (plan na dziś + zaległy) bez mapowania grupa/cecha.
 */

export type ZdEstimateScopeCoverageSupplier = {
  supplierId: string;
  supplierName: string;
  isOverduePlan?: boolean;
};

export type ZdEstimateScopeCoverage = {
  today: ZdEstimateScopeCoverageSupplier[];
  todayCount: number;
  mappedCount: number;
  unmapped: ZdEstimateScopeCoverageSupplier[];
};

export function collectTodayScheduleSuppliers(input: {
  todayKey: string;
  suppliers: readonly {
    id: string;
    name: string;
    computedNextDate?: string | null;
    /** Jak Dziś: „w razie potrzeby” nie wchodzi do kolejki planowej. */
    orderOnDemand?: boolean;
  }[];
}): ZdEstimateScopeCoverageSupplier[] {
  const today = input.todayKey.trim();
  const byId = new Map<string, ZdEstimateScopeCoverageSupplier>();
  for (const s of input.suppliers) {
    if (s.orderOnDemand) continue;
    const next = (s.computedNextDate ?? "").trim();
    if (!next || !s.id) continue;
    if (next > today) continue;
    const prev = byId.get(s.id);
    const row: ZdEstimateScopeCoverageSupplier = {
      supplierId: s.id,
      supplierName: s.name.trim() || s.id,
      isOverduePlan: next < today,
    };
    if (!prev || row.isOverduePlan) byId.set(s.id, row);
  }
  return [...byId.values()].sort((a, b) =>
    a.supplierName.localeCompare(b.supplierName, "pl")
  );
}

export function zdEstimateScopeCoverage(
  todaySuppliers: readonly ZdEstimateScopeCoverageSupplier[],
  mappedSupplierIds: ReadonlySet<string> | readonly string[]
): ZdEstimateScopeCoverage {
  const mapped =
    mappedSupplierIds instanceof Set
      ? mappedSupplierIds
      : new Set(mappedSupplierIds);
  const unmapped = todaySuppliers.filter((s) => !mapped.has(s.supplierId));
  return {
    today: [...todaySuppliers],
    todayCount: todaySuppliers.length,
    mappedCount: todaySuppliers.length - unmapped.length,
    unmapped,
  };
}
