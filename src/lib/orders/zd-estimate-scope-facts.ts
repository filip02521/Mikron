import { formatPlDate } from "@/lib/display-labels";

export type ZdEstimateScopeFactParts = {
  /** Główna etykieta zakresu (najbardziej konkretna). */
  primary: string;
  /** Dostawca — tylko gdy osobny od primary. */
  supplier: string | null;
  /** Zapas: „1 miesiąc · 30 d” albo „30 d zapasu”. */
  stock: string;
  /** Okno sprzedaży, np. „16.07.2026 – 14.08.2026”. */
  window: string;
  /** Pełny title / aria. */
  summaryTitle: string;
};

function normalizeLabel(value: string): string {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}

/**
 * Składa fakty zakresu: jeden primary bez dublowania Holtrade×2.
 * Gdy dostawca zawiera nazwę zakresu („Holtrade / ACETAL” ⊃ „ACETAL”),
 * bierze bogatszą etykietę jako primary.
 */
export function buildZdEstimateScopeFactParts(input: {
  scopeName: string;
  stockLabel: string | null;
  dniZapasu: string;
  supplierLabel: string | null;
  dataOd: string;
  dataDo: string;
}): ZdEstimateScopeFactParts {
  const scope = input.scopeName.trim();
  const rawSupplier = input.supplierLabel?.trim() || null;
  const stock = input.stockLabel
    ? `${input.stockLabel} · ${input.dniZapasu} d`
    : `${input.dniZapasu} d zapasu`;
  const window = `${formatPlDate(input.dataOd)} – ${formatPlDate(input.dataDo)}`;

  let primary = scope;
  let supplier: string | null = rawSupplier;

  if (rawSupplier) {
    const s = normalizeLabel(scope);
    const u = normalizeLabel(rawSupplier);
    if (!s || s === u) {
      supplier = null;
    } else if (u.includes(s) && rawSupplier.length > scope.length) {
      primary = rawSupplier;
      supplier = null;
    } else if (s.includes(u)) {
      supplier = null;
    }
  }

  const summaryTitle = [
    primary,
    supplier ? `dostawca ${supplier}` : null,
    stock,
    `okno ${window}`,
  ]
    .filter(Boolean)
    .join(" · ");

  return { primary, supplier, stock, window, summaryTitle };
}

/** @deprecated Użyj buildZdEstimateScopeFactParts — zostaje pod testy jednostkowe. */
export function zdEstimateSupplierFactIsRedundant(
  scopeName: string,
  supplierLabel: string
): boolean {
  const parts = buildZdEstimateScopeFactParts({
    scopeName,
    stockLabel: null,
    dniZapasu: "0",
    supplierLabel,
    dataOd: "2026-01-01",
    dataDo: "2026-01-31",
  });
  return parts.supplier == null;
}
