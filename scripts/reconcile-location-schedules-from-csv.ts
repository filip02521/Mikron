/**
 * Porównuje supplier_schedules z eksportem POLSKA/ZAGRANICA/IMPORT (CSV = źródło prawdy).
 *   npx tsx --env-file=.env.local scripts/reconcile-location-schedules-from-csv.ts --dir "/Users/.../Downloads"
 *   npx tsx --env-file=.env.local scripts/reconcile-location-schedules-from-csv.ts --fix --dir "..."
 */
import { createClient } from "@supabase/supabase-js";
import { existsSync } from "fs";
import {
  applyLocationScheduleRows,
  LOCATION_SCHEDULE_NAME_ALIASES,
} from "./lib/apply-location-schedule-rows";
import {
  findLocationScheduleCsvs,
  readLocationScheduleCsv,
} from "./lib/location-schedule-csv";
import type { LocationScheduleRow } from "./lib/location-schedule-pdf";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;

type ScheduleFields = {
  order_date: string | null;
  computed_next_date: string | null;
  shift_date: string | null;
  vacation_note: string | null;
};

function dateOnly(v: string | null | undefined): string | null {
  if (!v?.trim()) return null;
  return v.trim().slice(0, 10);
}

function expectedFromCsv(row: LocationScheduleRow): ScheduleFields {
  return {
    order_date: dateOnly(row.order_date),
    computed_next_date: dateOnly(row.computed_next_date),
    shift_date: dateOnly(row.shift_date),
    vacation_note: row.vacation_note_raw?.trim() || null,
  };
}

function actualFromDb(row: {
  order_date: string | null;
  computed_next_date: string | null;
  shift_date: string | null;
  vacation_note: string | null;
}): ScheduleFields {
  return {
    order_date: dateOnly(row.order_date),
    computed_next_date: dateOnly(row.computed_next_date),
    shift_date: dateOnly(row.shift_date),
    vacation_note: row.vacation_note?.trim() || null,
  };
}

function diffFields(
  expected: ScheduleFields,
  actual: ScheduleFields
): string[] {
  const out: string[] = [];
  for (const field of [
    "order_date",
    "computed_next_date",
    "shift_date",
    "vacation_note",
  ] as const) {
    if (expected[field] !== actual[field]) {
      out.push(`${field}: DB=${actual[field] ?? "∅"} CSV=${expected[field] ?? "∅"}`);
    }
  }
  return out;
}

async function compareLocation(
  supabase: ReturnType<typeof createClient>,
  location: "POLSKA" | "ZAGRANICA" | "IMPORT",
  csvPath: string,
  fix: boolean
) {
  const rows = readLocationScheduleCsv(csvPath);
  const { data: suppliers, error: supErr } = await supabase
    .from("suppliers")
    .select("id, name")
    .eq("location", location);
  if (supErr) throw new Error(supErr.message);

  const byName = new Map(
    (suppliers ?? []).map((s) => [s.name.toUpperCase().trim(), s.id])
  );
  const aliases = LOCATION_SCHEDULE_NAME_ALIASES[location] ?? {};

  const supplierIds = [...byName.values()];
  const { data: schedules, error: schedErr } = await supabase
    .from("supplier_schedules")
    .select("supplier_id, order_date, computed_next_date, shift_date, vacation_note")
    .in("supplier_id", supplierIds);
  if (schedErr) throw new Error(schedErr.message);

  const schedBySupplier = new Map(
    (schedules ?? []).map((s) => [s.supplier_id, s])
  );

  const mismatches: Array<{ name: string; diffs: string[] }> = [];
  const missingInDb: string[] = [];
  const missingInCsv: string[] = [];

  for (const row of rows) {
    if (!row.name || /^w razie potrzeby$/i.test(row.name)) continue;
    const normalizedName = row.name.replace(/[\r\n]+/g, " ").replace(/\s+/g, " ").trim();
    const key = normalizedName.toUpperCase().trim();
    let id = byName.get(key);
    if (!id && aliases[key]) {
      id = byName.get(aliases[key].toUpperCase().trim());
    }
    if (!id) {
      missingInDb.push(row.name);
      continue;
    }

    const dbRow = schedBySupplier.get(id);
    if (!dbRow) {
      missingInCsv.push(`${row.name} (brak wiersza supplier_schedules)`);
      mismatches.push({ name: row.name, diffs: ["brak wiersza supplier_schedules"] });
      continue;
    }

    const diffs = diffFields(expectedFromCsv(row), actualFromDb(dbRow));
    if (diffs.length) mismatches.push({ name: row.name, diffs });
  }

  const csvNames = new Set(
    rows
      .filter((r) => r.name && !/^w razie potrzeby$/i.test(r.name))
      .map((r) =>
        r.name.replace(/[\r\n]+/g, " ").replace(/\s+/g, " ").trim().toUpperCase()
      )
  );
  for (const s of suppliers ?? []) {
    const normalizedDbName = s.name
      .replace(/[\r\n]+/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .toUpperCase();
    if (!csvNames.has(normalizedDbName)) {
      missingInCsv.push(s.name);
    }
  }

  console.log(`\n=== ${location} (${csvPath.split("/").pop()}) ===`);
  console.log(`CSV: ${rows.length} | dopasowane w bazie: ${rows.length - missingInDb.length}`);
  console.log(`Rozbieżności dat: ${mismatches.length}`);

  if (missingInDb.length) {
    console.log(`Brak dostawcy w bazie (${missingInDb.length}):`);
    missingInDb.slice(0, 10).forEach((n) => console.log(`  - ${n}`));
  }
  if (missingInCsv.length) {
    console.log(`W bazie, brak w CSV (${missingInCsv.length}):`);
    missingInCsv.slice(0, 10).forEach((n) => console.log(`  - ${n}`));
  }
  if (mismatches.length) {
    console.log("Różnice (max 40):");
    mismatches.slice(0, 40).forEach(({ name, diffs }) => {
      console.log(`  ${name}:`);
      diffs.forEach((d) => console.log(`    ${d}`));
    });
    if (mismatches.length > 40) {
      console.log(`  … i ${mismatches.length - 40} więcej`);
    }
  } else {
    console.log("OK — wszystkie daty zgodne z CSV.");
  }

  if (fix && mismatches.length) {
    const result = await applyLocationScheduleRows(supabase, location, rows);
    console.log(`Naprawiono: ${result.updated}/${result.total}`);
  }

  return mismatches.length;
}

async function main() {
  if (!url || !key) {
    console.error("Ustaw NEXT_PUBLIC_SUPABASE_URL i SUPABASE_SERVICE_ROLE_KEY");
    process.exit(1);
  }

  const argv = process.argv.slice(2);
  const fix = argv.includes("--fix");
  const dirIdx = argv.indexOf("--dir");
  const explicit: Partial<Record<"POLSKA" | "ZAGRANICA" | "IMPORT", string>> = {};

  for (const loc of ["POLSKA", "ZAGRANICA", "IMPORT"] as const) {
    const flag = `--${loc.toLowerCase()}`;
    const i = argv.indexOf(flag);
    if (i >= 0 && argv[i + 1]) explicit[loc] = argv[i + 1];
  }

  let found = explicit;
  if (dirIdx >= 0) {
    const dir = argv[dirIdx + 1];
    if (!dir || !existsSync(dir)) {
      console.error("Podaj istniejący katalog: --dir /path");
      process.exit(1);
    }
    found = { ...findLocationScheduleCsvs(dir), ...explicit };
  }

  const locs = (["POLSKA", "ZAGRANICA", "IMPORT"] as const).filter((l) => found[l]);
  if (!locs.length) {
    console.error(
      "Podaj --dir z CSV albo --polska/--zagranica/--import ze ścieżkami"
    );
    process.exit(1);
  }

  const supabase = createClient(url, key);
  let total = 0;
  for (const loc of locs) {
    total += await compareLocation(supabase, loc, found[loc]!, fix);
  }

  if (!fix && total > 0) {
    console.log(`\nŁącznie rozbieżności: ${total}. Uruchom z --fix aby nadpisać danymi z CSV.`);
    process.exit(2);
  }
  if (fix && total > 0) {
    console.log("\nPonowna weryfikacja po --fix…");
    let after = 0;
    for (const loc of locs) {
      after += await compareLocation(supabase, loc, found[loc]!, false);
    }
    if (after > 0) {
      console.error(`\nPo naprawie nadal ${after} rozbieżności.`);
      process.exit(3);
    }
    console.log("\nWszystkie harmonogramy zgodne z CSV.");
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
