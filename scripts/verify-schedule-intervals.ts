/**
 * Weryfikuje zgodność dat z interwałem (order + interwał ≈ kolejne).
 *
 *   npx tsx scripts/verify-schedule-intervals.ts ZAGRANICA
 */

import { createClient } from "@supabase/supabase-js";
import {
  calculateNextOrderDate,
  parseDateOnly,
  resolveSupplierInterval,
  formatDateString,
  formatIntervalLabel,
} from "../src/lib/orders/dates";
import { recalcScheduleRow } from "../src/lib/orders/recalc";
import type { SupplierLocation } from "../src/types/database";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;

function daysDiff(a: string, b: string): number {
  const da = parseDateOnly(a)!;
  const db = parseDateOnly(b)!;
  return Math.round((db.getTime() - da.getTime()) / 86400000);
}

async function main() {
  const location = (process.argv[2] || "ZAGRANICA").toUpperCase() as SupplierLocation;
  const supabase = createClient(url, key);

  const { data: suppliers } = await supabase
    .from("suppliers")
    .select("*, supplier_schedules(*)")
    .eq("location", location)
    .order("name");

  let ok = 0;
  let shiftManual = 0;
  let noInterval = 0;
  let diff = 0;
  let syncWouldChange = 0;
  const diffSamples: string[] = [];

  for (const s of suppliers ?? []) {
    const sch = Array.isArray(s.supplier_schedules)
      ? s.supplier_schedules[0]
      : s.supplier_schedules;

    const order = sch?.order_date;
    const next = sch?.computed_next_date;
    const shift = sch?.shift_date;
    const interval = resolveSupplierInterval(
      s.interval_raw as string | null,
      s.interval_weeks != null ? Number(s.interval_weeks) : null
    );

    if (shift) {
      shiftManual++;
      continue;
    }

    if (!order || !next || !interval) {
      noInterval++;
      continue;
    }

    const fromFormula = calculateNextOrderDate(parseDateOnly(order)!, interval);
    const formulaStr = fromFormula ? formatDateString(fromFormula) : null;

    if (formulaStr === next) {
      ok++;
    } else if (formulaStr) {
      diff++;
      if (diffSamples.length < 10) {
        diffSamples.push(
          `${s.name}: arkusz ${next}, wzór ${formulaStr} (Δ ${daysDiff(formulaStr, next)} dni, ${formatIntervalLabel(interval)})`
        );
      }
    }

    const recalc = recalcScheduleRow({
      orderDate: parseDateOnly(order),
      shiftDate: null,
      interval,
      location,
      vacations: [],
    });
    const afterSync = recalc.computedNextDate
      ? formatDateString(recalc.computedNextDate)
      : null;
    if (afterSync && afterSync !== next) syncWouldChange++;
  }

  console.log(`\nWeryfikacja interwałów · ${location} (${suppliers?.length ?? 0} dostawców)\n`);
  console.log(`  Zgodne z wzorem (bez przesunięcia):     ${ok}`);
  console.log(`  Z przesunięciem (ręczna data):         ${shiftManual}`);
  console.log(`  Brak danych do porównania:             ${noInterval}`);
  console.log(`  Arkusz ≠ order+interwał (może OK):     ${diff}`);
  console.log(`  Sync zmieniłby „kolejne” (bez shift):  ${syncWouldChange}`);

  if (diffSamples.length) {
    console.log("\nPrzykłady różnic (arkusz vs. interwał):");
    diffSamples.forEach((l) => console.log("  ·", l));
    console.log(
      "\nRóżnice mogą wynikać z urlopów, ręcznych korekt lub gdy arkusz jest źródłem prawdy."
    );
  }
}

main().catch(console.error);
