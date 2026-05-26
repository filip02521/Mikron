/**
 * Import statystyk dostaw z CSV (arkusz STATYSTYKI DOSTAW).
 *
 *   npx tsx scripts/import-delivery-stats-from-csv.ts "/ścieżka/do/pliku.csv"
 */
import { readFileSync } from "fs";
import { resolve } from "path";
import { parseCsv } from "./lib/parse-csv";
import { createAdminClient, hasSupabaseConfig } from "../src/lib/supabase/admin";
import {
  matchSupplierId,
  parseDeliveryStatsRows,
} from "../src/lib/orders/delivery-stats-import";

async function main() {
  const filePath = resolve(process.argv[2] ?? "");
  if (!filePath || process.argv[2] === undefined) {
    console.error(
      "Użycie: npx tsx scripts/import-delivery-stats-from-csv.ts <ścieżka.csv>"
    );
    process.exit(1);
  }
  if (!hasSupabaseConfig()) {
    console.error("Brak SUPABASE — ustaw .env.local");
    process.exit(1);
  }

  const grid = parseCsv(readFileSync(filePath, "utf8"));
  const parsed = parseDeliveryStatsRows(grid);
  console.log(`Wierszy w CSV: ${parsed.length}`);

  const supabase = createAdminClient();
  const { data: suppliers, error } = await supabase.from("suppliers").select("id, name");
  if (error) throw error;

  const list = suppliers ?? [];
  let upserted = 0;
  const unmatched: string[] = [];

  for (const row of parsed) {
    const supplierId = matchSupplierId(row.supplierName, list);
    if (!supplierId) {
      unmatched.push(row.supplierName);
      continue;
    }

    const { error: upsertError } = await supabase.from("delivery_stats").upsert(
      {
        supplier_id: supplierId,
        main_sum: row.main_sum,
        main_count: row.main_count,
        main_avg: row.main_avg,
        side_sum: row.side_sum,
        side_count: row.side_count,
        side_avg: row.side_avg,
        updated_at: row.updated_at ?? new Date().toISOString(),
      },
      { onConflict: "supplier_id" }
    );

    if (upsertError) {
      console.error(row.supplierName, upsertError.message);
    } else {
      upserted++;
    }
  }

  console.log(`Zapisano: ${upserted}/${parsed.length} dostawców`);
  if (unmatched.length) {
    console.log(`Bez dopasowania w bazie (${unmatched.length}):`);
    unmatched.forEach((n) => console.log(`  - ${n}`));
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
