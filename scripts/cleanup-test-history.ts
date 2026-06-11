/**
 * Usuwa wpisy testowe sprzed importu CSV oraz karty demo.
 *
 *   npx tsx scripts/cleanup-test-history.ts
 *   npx tsx scripts/cleanup-test-history.ts --dry-run
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync, existsSync } from "fs";
import { join } from "path";
import { parseCsv, headerIndex } from "./lib/parse-csv";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const dryRun = process.argv.includes("--dry-run");

const TEST_SALES_NAMES = ["Krzychu", "Filip"] as const;
const TEST_SALES_EMAILS = ["krzychu@example.com", "jan.kowalski@example.com"] as const;
const DEMO_SUPPLIERS = ["Dentaur Polska", "Euro Dental", "Import Med"] as const;
const TEST_PRODUCT_PATTERNS = [
  "%zwrotka%",
  "%dsaf%",
  "%sfasd%",
  "%Produkt demo%",
  "%produkt demo%",
];

/** Import historii indywidualnej z 2026-05-25 — starsze created_at = testy aplikacji. */
const IMPORT_CUTOFF_ISO = "2026-05-25T16:00:00.000Z";

function loadCsvIds(): Set<string> {
  const path = join(process.cwd(), "data", "historia_indywidualne.csv");
  if (!existsSync(path)) return new Set();
  const grid = parseCsv(readFileSync(path, "utf-8"));
  const idI = headerIndex(grid[0], "ID_ZAMÓWIENIA", "ID");
  const ids = new Set<string>();
  for (let i = 1; i < grid.length; i++) {
    const id = grid[i][idI]?.trim();
    if (id) ids.add(id);
  }
  return ids;
}

async function main() {
  if (!url || !key) {
    console.error("Ustaw NEXT_PUBLIC_SUPABASE_URL i SUPABASE_SERVICE_ROLE_KEY");
    process.exit(1);
  }

  const supabase = createClient(url, key);
  const csvIds = loadCsvIds();
  let indDeleted = 0;
  const normDeleted = 0;

  // 1. Zamówienia indywidualne sprzed importu CSV
  const { data: oldByDate } = await supabase
    .from("individual_orders")
    .select("id, products, created_at")
    .lt("created_at", IMPORT_CUTOFF_ISO);
  const oldIds = (oldByDate ?? []).map((r) => r.id);

  // 2. Nie ma w eksporcie CSV (np. ręczne testy w aplikacji)
  const notInCsv: string[] = [];
  if (csvIds.size > 0) {
    let from = 0;
    while (true) {
      const { data, error } = await supabase
        .from("individual_orders")
        .select("id")
        .range(from, from + 999);
      if (error) throw error;
      if (!data?.length) break;
      for (const row of data) {
        if (!csvIds.has(row.id)) notInCsv.push(row.id);
      }
      if (data.length < 1000) break;
      from += 1000;
    }
  }

  // 3. Śmieciowe produkty testowe
  const testProductIds: string[] = [];
  for (const pattern of TEST_PRODUCT_PATTERNS) {
    const { data } = await supabase
      .from("individual_orders")
      .select("id")
      .ilike("products", pattern);
    for (const row of data ?? []) testProductIds.push(row.id);
  }

  // 4. Karty demo handlowców (Krzychu, Filip test)
  const { data: testSales } = await supabase
    .from("sales_people")
    .select("id, name, email")
    .or(
      `name.in.(${TEST_SALES_NAMES.join(",")}),email.in.(${TEST_SALES_EMAILS.join(",")})`
    );
  const testSalesIds = (testSales ?? []).map((s) => s.id);
  const testSalesOrderIds: string[] = [];
  for (const sid of testSalesIds) {
    const { data } = await supabase
      .from("individual_orders")
      .select("id")
      .eq("sales_person_id", sid);
    for (const row of data ?? []) testSalesOrderIds.push(row.id);
  }

  const indToDelete = [
    ...new Set([...oldIds, ...notInCsv, ...testProductIds, ...testSalesOrderIds]),
  ];

  if (indToDelete.length && !dryRun) {
    for (let i = 0; i < indToDelete.length; i += 200) {
      const chunk = indToDelete.slice(i, i + 200);
      const { error } = await supabase.from("individual_orders").delete().in("id", chunk);
      if (error) throw error;
    }
  }
  indDeleted = indToDelete.length;

  // 5. Odepnij profile od kart demo i usuń handlowców testowych
  if (!dryRun && testSalesIds.length) {
    await supabase
      .from("profiles")
      .update({ sales_person_id: null })
      .in("sales_person_id", testSalesIds);
    await supabase.from("sales_people").delete().in("id", testSalesIds);
  }

  // 6. Dostawcy demo (bez zamówień)
  let demoSupDeleted = 0;
  for (const name of DEMO_SUPPLIERS) {
    const { data: sup } = await supabase
      .from("suppliers")
      .select("id")
      .eq("name", name)
      .maybeSingle();
    if (!sup) continue;
    const { count: ic } = await supabase
      .from("individual_orders")
      .select("*", { count: "exact", head: true })
      .eq("supplier_id", sup.id);
    const { count: nc } = await supabase
      .from("normal_order_history")
      .select("*", { count: "exact", head: true })
      .eq("supplier_id", sup.id);
    if ((ic ?? 0) === 0 && (nc ?? 0) === 0 && !dryRun) {
      await supabase.from("supplier_schedules").delete().eq("supplier_id", sup.id);
      await supabase.from("suppliers").delete().eq("id", sup.id);
      demoSupDeleted++;
    }
  }

  const { count: indLeft } = await supabase
    .from("individual_orders")
    .select("*", { count: "exact", head: true });
  const { count: normLeft } = await supabase
    .from("normal_order_history")
    .select("*", { count: "exact", head: true });

  console.log(dryRun ? "[dry-run] " : "", "Czyszczenie wpisów testowych:");
  console.log(`  indywidualne usunięte: ${indDeleted}`);
  if (indDeleted) {
    console.log(`    - sprzed importu: ${oldIds.length}`);
    console.log(`    - poza CSV: ${notInCsv.length}`);
    console.log(`    - produkt testowy: ${testProductIds.length}`);
    console.log(`    - handlowiec demo: ${testSalesOrderIds.length}`);
  }
  if (normDeleted) console.log(`  standardowe usunięte: ${normDeleted}`);
  console.log(`  handlowcy demo usunięci: ${dryRun ? 0 : testSalesIds.length}`);
  console.log(`  dostawcy demo usunięci: ${dryRun ? 0 : demoSupDeleted}`);
  console.log(`  pozostało: ${indLeft} indywidualnych, ${normLeft} standardowych`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
