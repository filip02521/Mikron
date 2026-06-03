import { resolveSupplierInterval } from "@/lib/orders/dates";

export type SupplierIntervalFields = {
  name: string;
  interval_raw?: string | null;
  interval_weeks?: number | null;
};

/** Dostawcy bez skonfigurowanego interwału — blokada Główne przed zapisem. */
export function supplierNamesWithoutOrderInterval(
  suppliers: SupplierIntervalFields[]
): string[] {
  return suppliers
    .filter(
      (s) =>
        !resolveSupplierInterval(
          s.interval_raw ?? null,
          s.interval_weeks != null ? Number(s.interval_weeks) : null
        )
    )
    .map((s) => s.name.trim() || "Dostawca");
}

export function formatGlowneMissingIntervalError(supplierNames: string[]): string {
  if (supplierNames.length === 1) {
    return `Brak interwału u dostawcy ${supplierNames[0]} — uzupełnij częstotliwość zamówień przed oznaczeniem jako Główne.`;
  }
  return `Brak interwału u dostawców: ${supplierNames.join(", ")} — uzupełnij częstotliwość przed Główne.`;
}
