/** Wspólne wartości zapasu i częstotliwości — zgodne z parseInterval w dates.ts */

export type SupplierCyclePreset = {
  id: string;
  label: string;
  /** Wartość zapisywana w stock_raw / interval_raw */
  raw: string;
};

export const SUPPLIER_STOCK_PRESETS: SupplierCyclePreset[] = [
  { id: "2m", label: "Zapas na 2 miesiące", raw: "2 MIESIĄCE" },
  { id: "1m", label: "Zapas na 1 miesiąc", raw: "1 MIESIĄC" },
  { id: "6w", label: "Zapas na 6 tygodni", raw: "6" },
  { id: "4w", label: "Zapas na 4 tygodnie", raw: "4" },
  { id: "on-demand", label: "W razie potrzeby", raw: "W RAZIE POTRZEBY" },
];

export const SUPPLIER_INTERVAL_PRESETS: SupplierCyclePreset[] = [
  { id: "2w", label: "Co 2 tygodnie", raw: "2" },
  { id: "4w", label: "Co 4 tygodnie", raw: "4" },
  { id: "6w", label: "Co 6 tygodni", raw: "6" },
  { id: "1m", label: "Co miesiąc", raw: "1 MIESIĄC" },
  { id: "2m", label: "Co 2 miesiące", raw: "2 MIESIĄCE" },
  { id: "3m", label: "Co kwartał", raw: "3 MIESIĄCE" },
  { id: "6m", label: "Co pół roku", raw: "6 MIESIĘCY" },
];

export const SUPPLIER_CYCLE_CUSTOM_ID = "__custom__";

function normalizeCycleRaw(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ");
}

export function matchSupplierCyclePreset(
  raw: string,
  presets: SupplierCyclePreset[]
): string {
  const normalized = normalizeCycleRaw(raw);
  if (!normalized) return SUPPLIER_CYCLE_CUSTOM_ID;
  const hit = presets.find((p) => normalizeCycleRaw(p.raw) === normalized);
  return hit?.id ?? SUPPLIER_CYCLE_CUSTOM_ID;
}

export function supplierCyclePresetById(
  id: string,
  presets: SupplierCyclePreset[]
): SupplierCyclePreset | undefined {
  return presets.find((p) => p.id === id);
}
