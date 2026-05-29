import { readdirSync, readFileSync } from "fs";
import { join } from "path";
import { parseCsv } from "./parse-csv";
import type { LocationScheduleRow } from "./location-schedule-pdf";
import { parseSheetScheduleRow } from "./sheet-schedule-row";

/** Eksport Google Sheets: POLSKA / ZAGRANICA / IMPORT (nagłówek DOSTAWCA, …). */
export function parseLocationScheduleCsv(content: string): LocationScheduleRow[] {
  const grid = parseCsv(content);
  if (grid.length < 2) return [];

  const headers = grid[0];
  const rows: LocationScheduleRow[] = [];

  for (let r = 1; r < grid.length; r++) {
    const row = parseSheetScheduleRow(headers, grid[r]);
    if (row) rows.push(row);
  }

  const byName = new Map<string, LocationScheduleRow>();
  for (const row of rows) byName.set(row.name, row);
  return [...byName.values()].sort((a, b) => a.name.localeCompare(b.name, "pl"));
}

export function readLocationScheduleCsv(path: string): LocationScheduleRow[] {
  return parseLocationScheduleCsv(readFileSync(path, "utf-8"));
}

/** Szuka plików eksportu zakładek w katalogu (np. Downloads). */
export function findLocationScheduleCsvs(
  dir: string
): Partial<Record<"POLSKA" | "ZAGRANICA" | "IMPORT", string>> {
  const out: Partial<Record<"POLSKA" | "ZAGRANICA" | "IMPORT", string>> = {};
  const names = readdirSync(dir).filter((n) => n.toLowerCase().endsWith(".csv"));

  for (const loc of ["POLSKA", "ZAGRANICA", "IMPORT"] as const) {
    const exact = names.find((n) => new RegExp(`^${loc}\\.csv$`, "i").test(n));
    if (exact) {
      out[loc] = join(dir, exact);
      continue;
    }
    const sheet = names.find(
      (n) =>
        new RegExp(`-\\s*${loc}\\.csv$`, "i").test(n) ||
        (loc === "IMPORT"
          ? /-\s*import\.csv$/i.test(n) && !/historia/i.test(n)
          : new RegExp(`${loc}`, "i").test(n) &&
            !/historia|ustawienia|statystyki|dla_kogos/i.test(n))
    );
    if (sheet) out[loc] = join(dir, sheet);
  }
  return out;
}
