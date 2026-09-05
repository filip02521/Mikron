/**
 * Uzupełnia interval_raw z data/ustawienia.json (po migracji 002).
 * npx tsx scripts/backfill-interval-raw.ts
 */

import { createAdminClient as createClient } from "../src/lib/db/admin";
import { readFileSync } from "fs";
import { join } from "path";
import { intervalWeeksForStorage, parseInterval } from "../src/lib/orders/dates";


/** Nazwa w PDF ≠ nazwa w bazie (po imporcie harmonogramów). */
const NAME_ALIASES: Record<string, string> = {
  "AND DEVELOPMENT": "FUTURE TECHNOLOGY AND DEVELOPMENT",
  "FUTURE TECHNOLOGY": "FUTURE TECHNOLOGY AND DEVELOPMENT",
};

async function main() {
  if (!process.env.DATABASE_URL?.trim()) {
  console.error("Ustaw DATABASE_URL (.env / .env.local)");
  process.exit(1);
}

  const rows = JSON.parse(
    readFileSync(join(process.cwd(), "data", "ustawienia.json"), "utf-8")
  ) as { name: string; interval_raw: string }[];

  const supabase = createClient();
  let ok = 0;
  let fail = 0;

  let missing = 0;
  let withInterval = 0;

  for (const r of rows) {
    const raw = (r.interval_raw ?? "").trim();
    if (raw) withInterval++;
    const parsed = parseInterval(raw);
    const { data, error } = await supabase
      .from("suppliers")
      .update({
        interval_raw: raw,
        interval_weeks: intervalWeeksForStorage(raw, parsed),
        updated_at: new Date().toISOString(),
      })
      .eq("name", NAME_ALIASES[r.name] ?? r.name)
      .select("id");

    if (error) {
      if (error.message.includes("interval_raw")) {
        console.error(
          "Brak kolumny interval_raw — uruchom migrację 002_interval_raw.sql w Supabase"
        );
        process.exit(1);
      }
      fail++;
    } else if (!data?.length) {
      missing++;
    } else ok++;
  }

  console.log(`Interwały: ${ok}/${rows.length} zaktualizowanych w bazie`);
  console.log(`  w arkuszu z wartością w kol. H: ${withInterval}, brak dostawcy: ${missing}, błędy: ${fail}`);
}

main().catch(console.error);
