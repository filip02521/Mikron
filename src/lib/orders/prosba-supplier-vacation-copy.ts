/**
 * Copy + helpery — urlop dostawcy na formularzu prośby (handlowiec).
 * Semantyka: „urlop teraz” jak w panelu zakupów (nie vacation_note z harmonogramu).
 */

import {
  formatSupplierVacationRangeCompact,
  formatSupplierVacationRangeTitle,
  type SupplierOnVacationWindow,
} from "@/lib/orders/procurement-supplier-vacation";

export const PROSBA_SUPPLIER_VACATION_COPY = {
  titleOne: "Dostawca na urlopie",
  titleMany: "Dostawcy na urlopie",
  canStillSubmit:
    "Prośbę możesz wysłać — zakupy zobaczą to przy obsłudze; termin realizacji może się przesunąć.",
  differentRanges: "różne okresy",
} as const;

export type ProsbaVacationHit = {
  supplierId: string;
  supplierName: string;
  window: SupplierOnVacationWindow;
};

export type ProsbaVacationNoticeModel = {
  title: string;
  description: string;
  rangeTitle: string;
  hits: ProsbaVacationHit[];
};

function supplierNameFromMap(
  id: string,
  names: Record<string, string> | Map<string, string> | undefined
): string {
  if (!names) return id;
  if (names instanceof Map) return names.get(id)?.trim() || id;
  return names[id]?.trim() || id;
}

/** Unia supplierId z linii + opcjonalny fallback (np. ?dostawca= / group[0]). */
export function collectProsbaSupplierIds(
  lines: { supplierId?: string | null }[],
  fallbackSupplierId?: string | null
): string[] {
  const ids = new Set<string>();
  for (const line of lines) {
    const id = line.supplierId?.trim();
    if (id) ids.add(id);
  }
  const fallback = fallbackSupplierId?.trim();
  if (fallback) ids.add(fallback);
  return [...ids];
}

export function collectProsbaVacationHits(
  lines: { supplierId?: string | null }[],
  vacationMap: Record<string, SupplierOnVacationWindow>,
  options?: {
    fallbackSupplierId?: string | null;
    supplierNames?: Record<string, string> | Map<string, string>;
  }
): ProsbaVacationHit[] {
  if (!vacationMap || Object.keys(vacationMap).length === 0) return [];
  const ids = collectProsbaSupplierIds(lines, options?.fallbackSupplierId);
  const hits: ProsbaVacationHit[] = [];
  for (const id of ids) {
    const window = vacationMap[id];
    if (!window) continue;
    hits.push({
      supplierId: id,
      supplierName: supplierNameFromMap(id, options?.supplierNames),
      window,
    });
  }
  return hits;
}

function formatNamesList(names: string[]): string {
  if (names.length === 0) return "";
  if (names.length === 1) return names[0]!;
  if (names.length === 2) return `${names[0]} i ${names[1]}`;
  return `${names.slice(0, 2).join(", ")} +${names.length - 2}`;
}

export function buildProsbaSupplierVacationNoticeModel(
  hits: ProsbaVacationHit[]
): ProsbaVacationNoticeModel | null {
  if (hits.length === 0) return null;

  if (hits.length === 1) {
    const hit = hits[0]!;
    const compact = formatSupplierVacationRangeCompact(hit.window);
    return {
      title: PROSBA_SUPPLIER_VACATION_COPY.titleOne,
      description: `${hit.supplierName} ma urlop ${compact}. ${PROSBA_SUPPLIER_VACATION_COPY.canStillSubmit}`,
      rangeTitle: formatSupplierVacationRangeTitle(hit.window),
      hits,
    };
  }

  const names = formatNamesList(hits.map((h) => h.supplierName));
  const firstRange = formatSupplierVacationRangeCompact(hits[0]!.window);
  const allSameRange = hits.every(
    (h) =>
      h.window.startDate === hits[0]!.window.startDate &&
      h.window.endDate === hits[0]!.window.endDate
  );
  const rangePart = allSameRange
    ? firstRange
    : PROSBA_SUPPLIER_VACATION_COPY.differentRanges;

  return {
    title: PROSBA_SUPPLIER_VACATION_COPY.titleMany,
    description: `${names} — urlop ${rangePart}. ${PROSBA_SUPPLIER_VACATION_COPY.canStillSubmit}`,
    rangeTitle: allSameRange
      ? formatSupplierVacationRangeTitle(hits[0]!.window)
      : hits
          .map(
            (h) =>
              `${h.supplierName}: ${formatSupplierVacationRangeTitle(h.window)}`
          )
          .join(" · "),
    hits,
  };
}
