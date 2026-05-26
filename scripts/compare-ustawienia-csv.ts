/**
 * Porównanie eksportu USTAWIENIA.csv z bazą suppliers.
 * npx tsx scripts/compare-ustawienia-csv.ts "/path/to/USTAWIENIA.csv"
 */
import { readFileSync } from "fs";
import { resolve } from "path";
import { createAdminClient, hasSupabaseConfig } from "../src/lib/supabase/admin";
import { parseCsv, headerIndex } from "./lib/parse-csv";
import { parseInterval, intervalWeeksForStorage } from "../src/lib/orders/dates";
import { matchSupplierId, normalizeSupplierName } from "../src/lib/orders/delivery-stats-import";

type CsvRow = {
  name: string;
  location: string;
  pickup_mikran: boolean;
  pickup_pallet: boolean;
  notes: string;
  mails: string;
  extra_info: string;
  interval_raw: string;
  interval_weeks: number | null;
  stock_raw: string;
  stock: number | null;
  stats_mode: "LACZNIE" | "OSOBNO";
};

function norm(s: string): string {
  return s.trim().replace(/\s+/g, " ");
}

function normKey(name: string): string {
  return normalizeSupplierName(name);
}

function parseRows(grid: string[][]): CsvRow[] {
  const h = grid[0];
  const col = {
    supplier: headerIndex(h, "DOSTAWCY", "DOSTAWCA"),
    location: headerIndex(h, "LOKALIZACJA"),
    pickup: headerIndex(h, "ODBIÓR", "ODBIOR"),
    notes: headerIndex(h, "SPOSÓB"),
    mails: headerIndex(h, "MAILE / STRONY", "MAILE"),
    extra: headerIndex(h, "DODATKOWE"),
    interval: headerIndex(h, "INTERWAL"),
    stock: headerIndex(h, "ZAPAS"),
    stats: headerIndex(h, "STATYSTYKI"),
  };

  const rows: CsvRow[] = [];
  for (let i = 1; i < grid.length; i++) {
    const r = grid[i];
    const name = r[col.supplier]?.trim();
    if (!name) continue;
    const location = (r[col.location]?.trim() || "POLSKA").toUpperCase();
    const pickup = (r[col.pickup] || "").toUpperCase();
    const intervalRaw = (r[col.interval] || "").trim();
    const stockRaw = (r[col.stock] || "").trim();
    const statsRaw = (r[col.stats] || "ŁĄCZNIE").toUpperCase();

    rows.push({
      name,
      location,
      pickup_mikran: pickup.includes("KIEROWCA MIKRAN"),
      pickup_pallet: pickup.includes("ZLECAMY ODBIÓR") || pickup.includes("ZLECAMY ODBIOR"),
      notes: norm(r[col.notes] || ""),
      mails: norm(r[col.mails] || ""),
      extra_info: norm(r[col.extra] || ""),
      interval_raw: intervalRaw,
      interval_weeks: intervalWeeksForStorage(intervalRaw, parseInterval(intervalRaw)),
      stock_raw: stockRaw,
      stock: intervalWeeksForStorage(stockRaw, parseInterval(stockRaw)),
      stats_mode: statsRaw === "OSOBNO" ? "OSOBNO" : "LACZNIE",
    });
  }
  return rows;
}

type DbSupplier = {
  id: string;
  name: string;
  location: string;
  pickup_mikran: boolean;
  pickup_pallet: boolean;
  notes: string;
  mails: string;
  extra_info: string;
  interval_raw: string | null;
  interval_weeks: number | null;
  stock_raw: string | null;
  stock: number | null;
  stats_mode: string;
};

function dbRow(s: DbSupplier): CsvRow {
  return {
    name: s.name,
    location: s.location,
    pickup_mikran: s.pickup_mikran,
    pickup_pallet: s.pickup_pallet,
    notes: norm(s.notes || ""),
    mails: norm(s.mails || ""),
    extra_info: norm(s.extra_info || ""),
    interval_raw: norm(s.interval_raw || ""),
    interval_weeks: s.interval_weeks,
    stock_raw: norm(s.stock_raw || ""),
    stock: s.stock,
    stats_mode: s.stats_mode === "OSOBNO" ? "OSOBNO" : "LACZNIE",
  };
}

const FIELDS: (keyof Omit<CsvRow, "name">)[] = [
  "location",
  "pickup_mikran",
  "pickup_pallet",
  "notes",
  "mails",
  "extra_info",
  "interval_raw",
  "interval_weeks",
  "stock_raw",
  "stock",
  "stats_mode",
];

async function main() {
  const path = resolve(process.argv[2] ?? "");
  if (!path || !process.argv[2]) {
    console.error("Użycie: npx tsx scripts/compare-ustawienia-csv.ts <USTAWIENIA.csv>");
    process.exit(1);
  }
  if (!hasSupabaseConfig()) {
    console.error("Brak .env.local");
    process.exit(1);
  }

  const grid = parseCsv(readFileSync(path, "utf8"));
  const csvRows = parseRows(grid);
  console.log(`CSV (po parserze): ${csvRows.length} dostawców`);

  const byLoc = { POLSKA: 0, ZAGRANICA: 0, IMPORT: 0, other: 0 };
  for (const r of csvRows) {
    if (r.location in byLoc) byLoc[r.location as keyof typeof byLoc]++;
    else byLoc.other++;
  }
  console.log("CSV lokalizacje:", byLoc);

  const supabase = createAdminClient();
  const { data: dbList, error } = await supabase.from("suppliers").select("*");
  if (error) throw error;
  const db = (dbList ?? []) as DbSupplier[];
  console.log(`Baza: ${db.length} dostawców`);

  const dbByKey = new Map(db.map((s) => [normKey(s.name), s]));
  const csvByKey = new Map(csvRows.map((r) => [normKey(r.name), r]));

  const missingInDb: string[] = [];
  const missingInCsv: string[] = [];
  const nameMismatch: { csv: string; db: string }[] = [];
  const fieldDiffs: { name: string; field: string; csv: string; db: string }[] = [];

  for (const csv of csvRows) {
    const key = normKey(csv.name);
    let dbSup = dbByKey.get(key);
    if (!dbSup) {
      const id = matchSupplierId(csv.name, db);
      if (id) {
        dbSup = db.find((s) => s.id === id);
        if (dbSup && normKey(dbSup.name) !== key) {
          nameMismatch.push({ csv: csv.name, db: dbSup.name });
        }
      }
    }
    if (!dbSup) {
      missingInDb.push(csv.name);
      continue;
    }
    const expected = csv;
    const actual = dbRow(dbSup);
    for (const field of FIELDS) {
      const a = expected[field];
      const b = actual[field];
      const same =
        a === b ||
        (a == null && b == null) ||
        (typeof a === "string" && typeof b === "string" && a === b);
      if (!same) {
        fieldDiffs.push({
          name: csv.name,
          field,
          csv: String(a ?? ""),
          db: String(b ?? ""),
        });
      }
    }
  }

  for (const s of db) {
    const key = normKey(s.name);
    if (!csvByKey.has(key)) {
      const inCsv = csvRows.find((r) => matchSupplierId(r.name, db) === s.id);
      if (!inCsv) missingInCsv.push(s.name);
    }
  }

  console.log("\n=== PODSUMOWANIE ===");
  console.log(`Zgodne (dostawca w obu): ${csvRows.length - missingInDb.length}`);
  console.log(`Brak w bazie: ${missingInDb.length}`);
  console.log(`Tylko w bazie (brak w CSV): ${missingInCsv.length}`);
  console.log(`Różna nazwa (dopasowanie fuzzy): ${nameMismatch.length}`);
  console.log(`Różnice w polach: ${fieldDiffs.length}`);

  if (missingInDb.length) {
    console.log("\n--- Brak w bazie (pierwsze 25) ---");
    missingInDb.slice(0, 25).forEach((n) => console.log(`  ${n}`));
  }
  if (missingInCsv.length) {
    console.log("\n--- Tylko w bazie ---");
    missingInCsv.slice(0, 25).forEach((n) => console.log(`  ${n}`));
  }
  if (nameMismatch.length) {
    console.log("\n--- Nazwa CSV vs baza (fuzzy) ---");
    nameMismatch.slice(0, 15).forEach((m) =>
      console.log(`  CSV: "${m.csv}"  →  DB: "${m.db}"`)
    );
  }

  const byField = new Map<string, number>();
  for (const d of fieldDiffs) {
    byField.set(d.field, (byField.get(d.field) ?? 0) + 1);
  }
  if (byField.size) {
    console.log("\n--- Różnice wg pola ---");
    [...byField.entries()]
      .sort((a, b) => b[1] - a[1])
      .forEach(([f, n]) => console.log(`  ${f}: ${n}`));
  }

  if (fieldDiffs.length) {
    console.log("\n--- Przykłady różnic (max 30) ---");
    fieldDiffs.slice(0, 30).forEach((d) => {
      const c = d.csv.length > 60 ? `${d.csv.slice(0, 60)}…` : d.csv;
      const b = d.db.length > 60 ? `${d.db.slice(0, 60)}…` : d.db;
      console.log(`  [${d.name}] ${d.field}`);
      console.log(`    CSV: ${c || "(puste)"}`);
      console.log(`    DB:  ${b || "(puste)"}`);
    });
  }

  let zapasInExtra = 0;
  let intervalWeeksInStock = 0;
  let intervalOk = 0;
  let coreMatch = 0;
  for (const csv of csvRows) {
    const dbSup =
      dbByKey.get(normKey(csv.name)) ??
      db.find((s) => matchSupplierId(csv.name, db) === s.id);
    if (!dbSup) continue;
    if (csv.stock_raw && norm(dbSup.extra_info) === norm(csv.stock_raw)) zapasInExtra++;
    const interW = csv.interval_weeks;
    if (
      interW != null &&
      (dbSup.stock === interW || String(dbSup.stock_raw) === String(interW))
    ) {
      intervalWeeksInStock++;
    }
    if (norm(dbSup.interval_raw) === norm(csv.interval_raw)) intervalOk++;
    const pickupOk =
      csv.pickup_mikran === dbSup.pickup_mikran &&
      csv.pickup_pallet === dbSup.pickup_pallet;
    if (
      csv.location === dbSup.location &&
      csv.notes === norm(dbSup.notes) &&
      csv.stats_mode === (dbSup.stats_mode === "OSOBNO" ? "OSOBNO" : "LACZNIE") &&
      pickupOk &&
      norm(dbSup.interval_raw) === norm(csv.interval_raw) &&
      norm(dbSup.stock_raw) === norm(csv.stock_raw) &&
      norm(dbSup.extra_info) === norm(csv.extra_info)
    ) {
      coreMatch++;
    }
  }

  console.log("\n=== WZORCE (diagnoza importu PDF / starej bazy) ===");
  console.log(
    `Pełna zgodność pól z CSV: ${coreMatch}/${csvRows.length} (${Math.round((100 * coreMatch) / csvRows.length)}%)`
  );
  console.log(`Interwał (tekst) zgodny: ${intervalOk}/${csvRows.length}`);
  console.log(
    `ZAPAS z CSV trafia w extra_info w bazie (błąd mapowania): ${zapasInExtra}`
  );
  console.log(
    `Tygodnie INTERWAŁu w stock_raw/stock (błąd mapowania): ${intervalWeeksInStock}`
  );
  console.log(
    "\nRekomendacja: uruchom import z tego CSV (migrate) — nadpisze suppliers według arkusza."
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
