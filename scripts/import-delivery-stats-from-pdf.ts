/**
 * Import statystyk dostaw z tekstu PDF (arkusz STATYSTYKI DOSTAW).
 *
 * Użycie:
 *   npx tsx scripts/import-delivery-stats-from-pdf.ts "/ścieżka/do/pliku.pdf"
 *   npm run import-stats-pdf -- "/ścieżka/do/pliku.pdf"
 */
import { readFileSync } from "fs";
import { dirname, resolve } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
import { createAdminClient, hasSupabaseConfig } from "../src/lib/supabase/admin";
import {
  matchSupplierId,
  parseDeliveryStatsText,
} from "../src/lib/orders/delivery-stats-import";

const DEFAULT_TXT = resolve(__dirname, "../data/statystyki-dostaw.txt");

async function main() {
  const filePath = resolve(process.argv[2] ?? DEFAULT_TXT);
  if (!hasSupabaseConfig()) {
    console.error("Brak SUPABASE — ustaw .env.local");
    process.exit(1);
  }

  let text: string;
  try {
    text = readFileSync(filePath, "utf8");
  } catch {
    console.error(`Nie można odczytać: ${filePath}`);
    console.error("Podaj ścieżkę do pliku .txt (np. data/statystyki-dostaw.txt).");
    process.exit(1);
  }

  const parsed = parseDeliveryStatsText(text);
  console.log(`Wierszy w pliku: ${parsed.length}`);

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

  console.log(`Zapisano: ${upserted} dostawców`);
  if (unmatched.length) {
    console.log(`Bez dopasowania (${unmatched.length}):`);
    unmatched.slice(0, 20).forEach((n) => console.log(`  - ${n}`));
    if (unmatched.length > 20) console.log(`  … i ${unmatched.length - 20} więcej`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
