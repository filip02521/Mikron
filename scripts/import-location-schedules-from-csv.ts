/**
 * Import bieżącego stanu harmonogramów z eksportu CSV zakładek
 * POLSKA / ZAGRANICA / IMPORT (Google Sheets).
 *
 * Kolumny jak w arkuszu: F=DATA ZAMÓWIENIA, G=DATA KOLEJNEGO, H=PRZESUNIĘCIE.
 * G trafia do computed_next_date, H do shift_date (osobno, bez zamiany).
 *
 *   npx tsx scripts/import-location-schedules-from-csv.ts ZAGRANICA "/path/ZAGRANICA.csv"
 *   npx tsx scripts/import-location-schedules-from-csv.ts --dir "/Users/.../Downloads"
 */

import { createClient } from "@supabase/supabase-js";
import { existsSync } from "fs";
import {
  findLocationScheduleCsvs,
  readLocationScheduleCsv,
} from "./lib/location-schedule-csv";
import { applyLocationScheduleRows } from "./lib/apply-location-schedule-rows";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;

async function importOne(location: string, csvPath: string) {
  const rows = readLocationScheduleCsv(csvPath);
  const supabase = createClient(url, key);
  const result = await applyLocationScheduleRows(supabase, location, rows);
  console.log(`${location}: zaktualizowano ${result.updated}/${result.total} (${csvPath})`);
  if (result.missing.length) {
    console.warn(
      `Brak w bazie (${result.missing.length}):`,
      result.missing.slice(0, 12).join(", ")
    );
  }
  return result;
}

async function main() {
  if (!url || !key) {
    console.error("Ustaw NEXT_PUBLIC_SUPABASE_URL i SUPABASE_SERVICE_ROLE_KEY");
    process.exit(1);
  }

  const argv = process.argv.slice(2);
  const dirIdx = argv.indexOf("--dir");
  if (dirIdx >= 0) {
    const dir = argv[dirIdx + 1];
    if (!dir || !existsSync(dir)) {
      console.error("Podaj istniejący katalog: --dir /path");
      process.exit(1);
    }
    const found = findLocationScheduleCsvs(dir);
    const locs = Object.keys(found) as ("POLSKA" | "ZAGRANICA" | "IMPORT")[];
    if (!locs.length) {
      console.error(`Brak CSV POLSKA/ZAGRANICA/IMPORT w ${dir}`);
      process.exit(1);
    }
    for (const loc of locs) {
      await importOne(loc, found[loc]!);
    }
    return;
  }

  const location = (argv[0] || "ZAGRANICA").toUpperCase();
  const csvPath = argv[1];
  if (!["POLSKA", "ZAGRANICA", "IMPORT"].includes(location)) {
    console.error("Lokalizacja: POLSKA | ZAGRANICA | IMPORT");
    process.exit(1);
  }
  if (!csvPath || !existsSync(csvPath)) {
    console.error("Użycie: … ZAGRANICA /ścieżka/do.csv  lub  … --dir /Downloads");
    process.exit(1);
  }
  await importOne(location, csvPath);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
