import type { ParsedDeliveryStatsRow } from "@/lib/orders/delivery-stats-schema";
import { resolveCanonicalSupplierName } from "./supplier-aliases";

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

function optionalInt(cell: string | undefined): number | null {
  if (!cell?.trim()) return null;
  const n = parseInt(cell.trim(), 10);
  return Number.isNaN(n) ? null : n;
}

function parseUpdatedAt(cell: string | undefined): string | null {
  const raw = cell?.trim();
  if (!raw) return null;
  const iso = raw.includes("T") ? raw : raw.replace(" ", "T");
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

/**
 * Eksport CSV z arkusza STATYSTYKI DOSTAW (nagłówek + wiersze jako tablica kolumn).
 */
export function parseDeliveryStatsRows(grid: string[][]): ParsedDeliveryStatsRow[] {
  if (grid.length < 2) return [];

  const headers = grid[0].map((h) => h.toUpperCase().trim());
  const col = (label: string) => headers.findIndex((h) => h.includes(label));

  const supplierI = col("DOSTAWCA");
  const mainSumI = col("SUMA DNI (GŁÓWNE)");
  const mainCountI = col("LICZBA DOSTAW (GŁÓWNE)");
  const mainAvgI = col("ŚREDNI CZAS (GŁÓWNE)");
  const sideSumI = col("SUMA DNI (POBOCZNE)");
  const sideCountI = col("LICZBA DOSTAW (POBOCZNE)");
  const sideAvgI = col("ŚREDNI CZAS (POBOCZNE)");
  const updatedI = col("OSTATNIA AKTUALIZACJA");

  if (supplierI < 0) return [];

  const out: ParsedDeliveryStatsRow[] = [];
  for (let i = 1; i < grid.length; i++) {
    const row = grid[i];
    const supplierName = row[supplierI]?.trim();
    if (!supplierName || /^DOSTAWCA$/i.test(supplierName)) continue;

    out.push({
      supplierName,
      main_sum: mainSumI >= 0 ? optionalInt(row[mainSumI]) : null,
      main_count: mainCountI >= 0 ? optionalInt(row[mainCountI]) : null,
      main_avg: mainAvgI >= 0 ? optionalInt(row[mainAvgI]) : null,
      side_sum: sideSumI >= 0 ? optionalInt(row[sideSumI]) : null,
      side_count: sideCountI >= 0 ? optionalInt(row[sideCountI]) : null,
      side_avg: sideAvgI >= 0 ? optionalInt(row[sideAvgI]) : null,
      updated_at: updatedI >= 0 ? parseUpdatedAt(row[updatedI]) : null,
    });
  }
  return out;
}

/** Normalizacja nazwy do dopasowania PDF ↔ baza. */
export function normalizeSupplierName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/[\u201c\u201d\u201e]/g, '"');
}

export function matchSupplierId(
  supplierName: string,
  suppliers: { id: string; name: string }[]
): string | null {
  const canonical = resolveCanonicalSupplierName(supplierName);
  const norm = normalizeSupplierName(canonical);
  const exact = suppliers.find((s) => normalizeSupplierName(s.name) === norm);
  if (exact) return exact.id;

  const ci = suppliers.find(
    (s) => s.name.trim().toLowerCase() === canonical.trim().toLowerCase()
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
