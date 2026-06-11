/**
 * Walidacja eksportu arkuszy POLSKA / ZAGRANICA / IMPORT (CSV z Google Sheets).
 *
 *   npx tsx scripts/validate-location-schedule-csv.ts <plik.csv> [LOKALIZACJA]
 */
import { readFileSync } from "fs";
import { parseCsv, headerIndex } from "./lib/parse-csv";
import { parseFlexibleDate } from "./lib/location-schedule-pdf";
import { parseInterval, calculateNextOrderDate, formatDateString } from "../src/lib/orders/dates";
import { createClient } from "@supabase/supabase-js";
import { matchSupplierId } from "../src/lib/orders/delivery-stats-import";

type Issue = { row: number; supplier: string; kind: string; detail: string };

function parseStockCell(raw: string): { ok: boolean; detail: string } {
  const v = raw.trim();
  if (!v) return { ok: true, detail: "brak" };
  if (/w razie potrzeby/i.test(v)) return { ok: true, detail: "W RAZIE POTRZEBY" };
  if (/^\d+$/.test(v)) return { ok: true, detail: `${v} (jako tygodnie w systemie)` };
  const p = parseInterval(v);
  if (p) return { ok: true, detail: formatIntervalShort(p) };
  return { ok: false, detail: `nieparsowalny ZAPAS: „${v}"` };
}

function formatIntervalShort(p: { unit: string; value: number }): string {
  return p.unit === "weeks" ? `${p.value} tyg.` : `${p.value} mies.`;
}

function daysBetween(a: string, b: string): number | null {
  const da = parseFlexibleDate(a);
  const db = parseFlexibleDate(b);
  if (!da || !db) return null;
  return Math.round((new Date(db).getTime() - new Date(da).getTime()) / 86400000);
}

async function main() {
  const path = process.argv[2];
  const location = (process.argv[3] || "").toUpperCase();
  if (!path) {
    console.error("Użycie: npx tsx scripts/validate-location-schedule-csv.ts <ścieżka.csv> [POLSKA|ZAGRANICA|IMPORT]");
    process.exit(1);
  }

  const grid = parseCsv(readFileSync(path, "utf-8"));
  if (grid.length < 2) {
    console.error("Pusty plik CSV");
    process.exit(1);
  }

  const h = grid[0];
  const nameI = headerIndex(h, "DOSTAWCA");
  const orderI = headerIndex(h, "DATA ZAMÓWIENIA", "DATA ZAM");
  const nextI = headerIndex(h, "DATA KOLEJNEGO", "DATA KOLEJNA", "KOLEJNE");
  const shiftI = headerIndex(h, "PRZESUNIĘCIE", "PRZESUNIECIE");
  const stockI = headerIndex(h, "ZAPAS");

  const issues: Issue[] = [];
  let withOrder = 0;
  let withNext = 0;
  let withShift = 0;
  let onDemand = 0;
  let isoDates = 0;
  let badDates = 0;

  const rows: {
    name: string;
    order: string | null;
    next: string | null;
    shift: string | null;
    stock: string;
  }[] = [];

  for (let i = 1; i < grid.length; i++) {
    const row = grid[i];
    const name = row[nameI >= 0 ? nameI : 0]?.trim();
    if (!name || /^DOSTAWCA$/i.test(name)) continue;

    const orderRaw = orderI >= 0 ? row[orderI]?.trim() ?? "" : "";
    const nextRaw = nextI >= 0 ? row[nextI]?.trim() ?? "" : "";
    const shiftRaw = shiftI >= 0 ? row[shiftI]?.trim() ?? "" : "";
    const stockRaw = stockI >= 0 ? row[stockI]?.trim() ?? "" : "";

    const order = orderRaw ? parseFlexibleDate(orderRaw) : null;
    const next = nextRaw ? parseFlexibleDate(nextRaw) : null;
    const shift = shiftRaw ? parseFlexibleDate(shiftRaw) : null;

    if (orderRaw && !order) {
      badDates++;
      issues.push({ row: i + 1, supplier: name, kind: "data_zamówienia", detail: orderRaw });
    } else if (order) isoDates++;

    if (nextRaw && !next) {
      badDates++;
      issues.push({ row: i + 1, supplier: name, kind: "data_kolejnego", detail: nextRaw });
    }

    if (shiftRaw && !shift) {
      badDates++;
      issues.push({ row: i + 1, supplier: name, kind: "przesunięcie", detail: shiftRaw });
    }

    if (!order && !next && !shift) onDemand++;
    if (order) withOrder++;
    if (next) withNext++;
    if (shift) withShift++;

    const stockCheck = parseStockCell(stockRaw);
    if (!stockCheck.ok) {
      issues.push({ row: i + 1, supplier: name, kind: "zapas", detail: stockCheck.detail });
    }

    if (order && next) {
      const d = daysBetween(order, next);
      if (d !== null && d < 0) {
        issues.push({
          row: i + 1,
          supplier: name,
          kind: "kolejność_dat",
          detail: `zamówienie ${order} > kolejne ${next}`,
        });
      }
    }

    if (shift && next && shift !== next) {
      const d = daysBetween(shift, next);
      if (d !== null && Math.abs(d) > 7) {
        issues.push({
          row: i + 1,
          supplier: name,
          kind: "przesunięcie_vs_kolejne",
          detail: `przesunięcie ${shift} ≠ kolejne ${next} (Δ ${d} dni)`,
        });
      }
    }

    rows.push({ name, order, next, shift, stock: stockRaw });
  }

  console.log(`\n=== ${path.split("/").pop()} ${location ? `(${location})` : ""} ===`);
  console.log(`Wierszy dostawców: ${rows.length}`);
  console.log(`Daty zamówienia: ${withOrder} | kolejne: ${withNext} | przesunięcie: ${withShift} | w razie potrzeby (brak dat): ${onDemand}`);
  console.log(`Format dat: ISO (YYYY-MM-DD): ${isoDates} | PL (DD-MM-YYYY) w surowym: wiele w ZAGRANICA/IMPORT`);
  console.log(`Nieparsowalne daty: ${badDates}`);

  if (issues.length) {
    console.log(`\nProblemy (${issues.length}):`);
    const byKind = new Map<string, number>();
    for (const iss of issues) {
      byKind.set(iss.kind, (byKind.get(iss.kind) ?? 0) + 1);
      if (issues.indexOf(iss) < 25) {
        console.log(`  w.${iss.row} [${iss.kind}] ${iss.supplier}: ${iss.detail}`);
      }
    }
    if (issues.length > 25) console.log(`  … i ${issues.length - 25} więcej`);
    console.log("  Podsumowanie:", Object.fromEntries(byKind));
  } else {
    console.log("\nBrak problemów strukturalnych w datach/ZAPAS.");
  }

  if (location && process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );
    const { data: suppliers } = await supabase
      .from("suppliers")
      .select("id, name, interval_raw, interval_weeks")
      .eq("location", location);

    const list = suppliers ?? [];
    let matched = 0;
    const missing: string[] = [];
    const intervalMismatch: string[] = [];

    for (const r of rows) {
      const id = matchSupplierId(r.name, list);
      if (!id) {
        missing.push(r.name);
        continue;
      }
      matched++;
      const sup = list.find((s) => s.id === id);
      if (!sup || !r.order || !r.next) continue;
      const interval = parseInterval(sup.interval_raw ?? "") ?? (sup.interval_weeks ? { unit: "weeks" as const, value: sup.interval_weeks } : null);
      if (!interval) continue;
      const fromFormula = calculateNextOrderDate(new Date(`${r.order}T12:00:00`), interval);
      const formulaStr = fromFormula ? formatDateString(fromFormula) : null;
      if (formulaStr && r.next && !r.shift && formulaStr !== r.next) {
        const delta = daysBetween(formulaStr, r.next);
        if (delta !== null && Math.abs(delta) > 7) {
          intervalMismatch.push(
            `${r.name}: arkusz ${r.next}, interwał ${sup.interval_raw} → ${formulaStr} (Δ ${delta} dni)`
          );
        }
      }
    }

    console.log(`\nDopasowanie do bazy (${location}): ${matched}/${rows.length}`);
    if (missing.length) {
      console.log(`Brak w ustawieniach (${missing.length}):`);
      missing.slice(0, 15).forEach((n) => console.log(`  - ${n}`));
    }
    if (intervalMismatch.length) {
      console.log(`\nRozjazd DATA KOLEJNEGO vs interwał z USTAWIENIA (${intervalMismatch.length} — często OK przy ręcznym przesunięciu):`);
      intervalMismatch.slice(0, 12).forEach((s) => console.log(`  ${s}`));
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
