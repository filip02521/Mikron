import type { ParsedDeliveryStatsRow } from "@/lib/orders/delivery-stats-schema";

const UPDATED_AT_RE =
  /(\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2})\s*$/;

function parseNums(tokens: string[]): number[] {
  return tokens.map((t) => parseInt(t, 10)).filter((n) => !Number.isNaN(n));
}

/**
 * Parsuje jeden wiersz eksportu PDF / arkusza STATYSTYKI DOSTAW.
 * Obsługuje tylko główne (3 liczby) lub główne+poboczne (6 liczb) przed datą aktualizacji.
 */
export function parseDeliveryStatsLine(line: string): ParsedDeliveryStatsRow | null {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("--")) return null;
  if (/^DOSTAWCA/i.test(trimmed)) return null;

  const updatedMatch = trimmed.match(UPDATED_AT_RE);
  if (!updatedMatch) return null;

  const updated_at = new Date(updatedMatch[1].replace(" ", "T")).toISOString();
  const beforeDate = trimmed.slice(0, updatedMatch.index).trim();
  const parts = beforeDate.split(/\t+|\s{2,}/).filter(Boolean);
  if (parts.length < 4) {
    const all = beforeDate.split(/\s+/);
    const dateIdx = all.findIndex((p) => /^\d{4}-\d{2}-\d{2}$/.test(p));
    if (dateIdx < 0) return null;
    const supplierName = all.slice(0, dateIdx - 3).join(" ").trim();
    const nums = parseNums(all.slice(Math.max(0, dateIdx - 6), dateIdx));
    return buildRow(supplierName, nums, updated_at);
  }

  const supplierName = parts[0].trim();
  const nums = parseNums(parts.slice(1));
  return buildRow(supplierName, nums, updated_at);
}

function buildRow(
  supplierName: string,
  nums: number[],
  updated_at: string
): ParsedDeliveryStatsRow | null {
  if (!supplierName) return null;

  if (nums.length === 3) {
    const [main_sum, main_count, main_avg] = nums;
    return {
      supplierName,
      main_sum,
      main_count,
      main_avg,
      side_sum: null,
      side_count: null,
      side_avg: null,
      updated_at,
    };
  }

  if (nums.length === 6) {
    const [main_sum, main_count, main_avg, side_sum, side_count, side_avg] = nums;
    return {
      supplierName,
      main_sum,
      main_count,
      main_avg,
      side_sum,
      side_count,
      side_avg,
      updated_at,
    };
  }

  return null;
}

export function parseDeliveryStatsText(text: string): ParsedDeliveryStatsRow[] {
  const rows: ParsedDeliveryStatsRow[] = [];
  for (const line of text.split(/\r?\n/)) {
    const row = parseDeliveryStatsLine(line);
    if (row) rows.push(row);
  }
  return rows;
}

/** Normalizacja nazwy do dopasowania PDF ↔ baza. */
export function normalizeSupplierName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/[""]/g, '"');
}

export function matchSupplierId(
  supplierName: string,
  suppliers: { id: string; name: string }[]
): string | null {
  const norm = normalizeSupplierName(supplierName);
  const exact = suppliers.find((s) => normalizeSupplierName(s.name) === norm);
  if (exact) return exact.id;

  const ci = suppliers.find(
    (s) => s.name.trim().toLowerCase() === supplierName.trim().toLowerCase()
  );
  if (ci) return ci.id;

  const contains = suppliers.filter(
    (s) =>
      normalizeSupplierName(s.name).includes(norm) ||
      norm.includes(normalizeSupplierName(s.name))
  );
  if (contains.length === 1) return contains[0].id;

  return null;
}
