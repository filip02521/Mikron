import {
  normalizeSalesAlias,
  SALES_SHEET_ALIASES,
} from "@/lib/sales/sales-person-import-aliases";

function normalizeKey(name: string): string {
  return name.trim().toUpperCase();
}

function resolveCanonicalName(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return trimmed;
  const upper = normalizeKey(trimmed);
  if (SALES_SHEET_ALIASES[upper]) return SALES_SHEET_ALIASES[upper];
  return normalizeSalesAlias(trimmed) ?? trimmed;
}

/** „Damian / Klinika X” → handlowiec + opcjonalny klient z arkusza. */
export function parseSalesPersonAndClient(raw: string): {
  salesName: string;
  clientName: string | null;
} {
  const trimmed = raw.trim();
  if (!trimmed.includes("/")) {
    return { salesName: resolveCanonicalName(trimmed), clientName: null };
  }
  const parts = trimmed.split("/").map((p) => p.trim());
  const salesName = resolveCanonicalName(parts[0] ?? "");
  const clientName = parts.slice(1).join(" / ").trim() || null;
  return { salesName, clientName };
}

export function salesPersonNameMatches(
  personName: string,
  canonicalSalesName: string
): boolean {
  const key = normalizeKey(canonicalSalesName);
  const personKey = normalizeKey(personName);
  if (personKey === key) return true;
  return resolveCanonicalName(personName) === canonicalSalesName;
}
