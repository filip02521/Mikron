import { normalizeSupplierName } from "./delivery-stats-import";

/** Nazwy z arkusza / historii → kanoniczna nazwa w `suppliers.name`. */
export const SUPPLIER_CANONICAL_NAMES: Record<string, string> = {
  "erkodent (giedrius juzenas)": "Giedrius Juzenas (Erkodent / Komet)",
  erkodent: "Giedrius Juzenas (Erkodent / Komet)",
};

export function resolveCanonicalSupplierName(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return trimmed;

  const norm = normalizeSupplierName(trimmed);
  const direct = SUPPLIER_CANONICAL_NAMES[norm];
  if (direct) return direct;

  if (/erkodent/i.test(trimmed) && /giedrius|juzenas/i.test(trimmed)) {
    return "Giedrius Juzenas (Erkodent / Komet)";
  }

  return trimmed;
}
