/**
 * Dopasowanie grupy Subiekta → karty dostawcy OnTime (zapas).
 * np. „Falcon” → Falcon (2 miesiące), „Ivoclar Technical” → Ivoclar Vivadent - EXCEL.
 */

function normalizeName(value: string): string {
  return value
    .toLowerCase()
    .replace(/ł/g, "l")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function firstToken(normalized: string): string {
  return normalized.split(/\s+/).find(Boolean) ?? "";
}

export type GroupSupplierMatchInput = {
  id: string;
  name: string;
};

/**
 * Szuka dostawcy po nazwie grupy towarowej.
 * 1) dokładna nazwa
 * 2) dostawca zaczyna się od pierwszego tokenu grupy (Falcon, Ivoclar, …)
 * 3) token grupy występuje na początku nazwy dostawcy
 */
export function matchSupplierForGroupName<T extends GroupSupplierMatchInput>(
  groupName: string,
  suppliers: readonly T[]
): T | null {
  const g = normalizeName(groupName);
  if (!g || suppliers.length === 0) return null;

  const exact = suppliers.find((s) => normalizeName(s.name) === g);
  if (exact) return exact;

  const token = firstToken(g);
  if (!token || token.length < 3) return null;

  const candidates = suppliers.filter((s) => {
    const n = normalizeName(s.name);
    return n === token || n.startsWith(`${token} `) || n.startsWith(token);
  });

  if (candidates.length === 0) {
    const loose = suppliers.filter((s) => {
      const n = normalizeName(s.name);
      return n.includes(` ${token} `) || n.endsWith(` ${token}`);
    });
    if (loose.length === 1) return loose[0]!;
    return null;
  }

  if (candidates.length === 1) return candidates[0]!;

  const preferExactToken = candidates.find((s) => normalizeName(s.name) === token);
  if (preferExactToken) return preferExactToken;

  return [...candidates].sort((a, b) => a.name.length - b.name.length)[0] ?? null;
}

export type AppliedStockWindow = {
  dniZapasu: number;
  dataOd: string;
  dataDo: string;
  supplierId: string | null;
  supplierName: string | null;
  stockLabel: string | null;
  matched: boolean;
};

/**
 * Po wyborze grupy: zapas z karty (jeśli match) + okno sprzedaży kończące się na salesEndKey.
 */
export function applyGroupStockWindow(input: {
  groupName: string;
  suppliers: readonly {
    id: string;
    name: string;
    dniZapasu: number | null;
    stockLabel: string;
  }[];
  salesEndKey: string;
  fallbackDniZapasu: number;
  salesWindowFromDniZapasu: (
    dniZapasu: number,
    endDateKey: string
  ) => { dataOd: string; dataDo: string };
}): AppliedStockWindow {
  const matched = matchSupplierForGroupName(input.groupName, input.suppliers);
  const dniZapasu =
    matched?.dniZapasu != null && matched.dniZapasu > 0
      ? matched.dniZapasu
      : input.fallbackDniZapasu;
  const window = input.salesWindowFromDniZapasu(dniZapasu, input.salesEndKey);

  return {
    dniZapasu,
    dataOd: window.dataOd,
    dataDo: window.dataDo,
    supplierId: matched?.id ?? null,
    supplierName: matched?.name ?? null,
    stockLabel: matched?.stockLabel ?? null,
    matched: Boolean(matched?.dniZapasu != null && matched.dniZapasu > 0),
  };
}
