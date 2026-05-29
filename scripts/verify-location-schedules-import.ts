/**
 * Porównuje supplier_schedules z eksportem CSV (100% zgodność F/G/H).
 *
 *   npx tsx scripts/verify-location-schedules-import.ts --dir "/Users/Filip/Downloads"
 */
import { createClient } from "@supabase/supabase-js";
import {
  findLocationScheduleCsvs,
  readLocationScheduleCsv,
} from "./lib/location-schedule-csv";
import { matchSupplierId } from "../src/lib/orders/delivery-stats-import";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;

function eq(a: string | null | undefined, b: string | null): boolean {
  return (a ?? null) === (b ?? null);
}

async function main() {
  const dirIdx = process.argv.indexOf("--dir");
  const dir = dirIdx >= 0 ? process.argv[dirIdx + 1] : null;
  if (!dir) {
    console.error("Użycie: … --dir /ścieżka/do/eksportów");
    process.exit(1);
  }
  if (!url || !key) {
    console.error("Brak NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY");
    process.exit(1);
  }

  const found = findLocationScheduleCsvs(dir);
  const supabase = createClient(url, key);
  let totalMismatch = 0;

  for (const loc of ["POLSKA", "ZAGRANICA", "IMPORT"] as const) {
    const path = found[loc];
    if (!path) {
      console.warn(`Pominięto ${loc}: brak CSV`);
      continue;
    }

    const csvRows = readLocationScheduleCsv(path);
    const { data: suppliers } = await supabase
      .from("suppliers")
      .select("id, name, supplier_schedules(order_date, shift_date, computed_next_date)")
      .eq("location", loc);

    const list = suppliers ?? [];
    const mismatches: string[] = [];
    let missing = 0;

    for (const r of csvRows) {
      const id = matchSupplierId(r.name, list);
      if (!id) {
        missing++;
        mismatches.push(`[brak w bazie] ${r.name}`);
        continue;
      }
      const sup = list.find((s) => s.id === id);
      const sch = sup?.supplier_schedules as {
        order_date: string | null;
        shift_date: string | null;
        computed_next_date: string | null;
      } | null;

      if (
        !eq(sch?.order_date, r.order_date) ||
        !eq(sch?.shift_date, r.shift_date) ||
        !eq(sch?.computed_next_date, r.computed_next_date)
      ) {
        totalMismatch++;
        mismatches.push(
          `${r.name}: arkusz F=${r.order_date} G=${r.computed_next_date} H=${r.shift_date ?? "—"} | baza F=${sch?.order_date} G=${sch?.computed_next_date} H=${sch?.shift_date ?? "—"}`
        );
      }
    }

    const bad = mismatches.length - missing;
    console.log(
      `${loc}: ${csvRows.length} wierszy CSV, rozjazdów ${bad}, brak dostawcy w bazie ${missing}`
    );
    mismatches.slice(0, 20).forEach((m) => console.log(`  ${m}`));
    if (mismatches.length > 20) console.log(`  … +${mismatches.length - 20}`);
  }

  if (totalMismatch > 0) process.exit(1);
  console.log("\nOK — harmonogramy zgodne z arkuszami (F/G/H).");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
