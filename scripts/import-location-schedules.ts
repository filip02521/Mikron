/**
 * Import harmonogramów 1:1 z data/{location}-schedules.json
 *
 *   npx tsx scripts/import-location-schedules.ts ZAGRANICA
 *   npx tsx scripts/import-location-schedules.ts POLSKA
 */

import { createAdminClient as createClient } from "../src/lib/db/admin";
import { readFileSync, existsSync } from "fs";
import { join } from "path";
import type { LocationScheduleRow } from "./lib/location-schedule-pdf";
import { applyLocationScheduleRows } from "./lib/apply-location-schedule-rows";


async function main() {
  const location = (process.argv[2] || "ZAGRANICA").toUpperCase();
  if (!["POLSKA", "ZAGRANICA", "IMPORT"].includes(location)) {
    console.error("Lokalizacja: POLSKA | ZAGRANICA | IMPORT");
    process.exit(1);
  }

  if (!process.env.DATABASE_URL?.trim()) {
  console.error("Ustaw DATABASE_URL (.env / .env.local)");
  process.exit(1);
}

  const slug = location.toLowerCase();
  const dataPath = join(process.cwd(), "data", `${slug}-schedules.json`);
  if (!existsSync(dataPath)) {
    console.error(`Brak ${dataPath} — uruchom build-${slug}-from-pdf`);
    process.exit(1);
  }

  const rows = (JSON.parse(readFileSync(dataPath, "utf-8")) as LocationScheduleRow[]).filter(
    (r) => r.name && !/^\d{4}-\d{2}-\d{2}$/.test(r.name) && !/^w razie potrzeby$/i.test(r.name)
  );

  const supabase = createClient();
  const result = await applyLocationScheduleRows(supabase, location, rows);

  console.log(`${location}: zaktualizowano ${result.updated}/${result.total}`);
  if (result.missing.length) {
    console.warn(`Brak w bazie (${result.missing.length}):`, result.missing.slice(0, 12).join(", "));
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
