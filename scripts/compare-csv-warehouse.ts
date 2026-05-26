/**
 * Porównanie eksportu CSV (Google Sheets) z kolejką magazynu i inwentaryzacją regału.
 * Usage: npx tsx scripts/compare-csv-warehouse.ts "/path/to/file.csv"
 */
import { readFileSync } from "fs";
import { createClient } from "@supabase/supabase-js";
import { buildWarehouseInventoryRow } from "../src/lib/orders/warehouse-inventory";
import type { IndividualOrder } from "../src/types/database";

function parseCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      inQ = !inQ;
      continue;
    }
    if (!inQ && c === ",") {
      out.push(cur);
      cur = "";
      continue;
    }
    cur += c;
  }
  out.push(cur);
  return out;
}

async function main() {
  const path =
    process.argv[2] ??
    "/Users/Filip/Downloads/System Dostaw v.9 Synchronizacja DK z HI, Częściowa realizacja - DLA KOGOŚ.csv";

  const lines = readFileSync(path, "utf8").split(/\r?\n/).filter(Boolean);
  const csvRows = lines.slice(1).map((line, i) => {
    const p = parseCsvLine(line);
    return {
      line: i + 2,
      actionDate: p[0],
      supplier: p[1],
      sku: p[2],
      product: p[3],
      qty: p[4],
      delivered: p[5],
      sales: p[6],
      status: p[7],
      flag: p[8],
      id: p[9]?.trim(),
    };
  }).filter((r) => r.id);

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const s = createClient(url, key);

  const ids = csvRows.map((r) => r.id);
  const dbById = new Map<string, IndividualOrder>();

  for (let i = 0; i < ids.length; i += 100) {
    const chunk = ids.slice(i, i + 100);
    const { data, error } = await s
      .from("individual_orders")
      .select(
        "id, status, quantity, delivered_quantity, sales_acknowledged_at, sales_cancelled_at, request_kind, warehouse_shelf, supplier_id, products, action_at, ordered_at, delivery_at, sales_person_id"
      )
      .in("id", chunk);
    if (error) throw error;
    for (const row of data ?? []) dbById.set(row.id, row as IndividualOrder);
  }

  const { data: whAll, error: whErr } = await s
    .from("individual_orders")
    .select(
      "id, status, quantity, delivered_quantity, sales_acknowledged_at, sales_cancelled_at, request_kind, warehouse_shelf, products"
    )
    .in("status", ["Zrealizowane", "Czesciowo_zrealizowane"])
    .is("sales_acknowledged_at", null)
    .is("sales_cancelled_at", null);
  if (whErr) throw whErr;

  const whIds = new Set(
    (whAll ?? [])
      .filter((o) => buildWarehouseInventoryRow(o as IndividualOrder))
      .map((o) => o.id)
  );

  const { data: dqAll, error: dqErr } = await s
    .from("individual_orders")
    .select("id, status, request_kind, sales_cancelled_at, supplier_id")
    .eq("request_kind", "zamowienie")
    .in("status", ["Zamowione", "Czesciowo_zrealizowane"])
    .is("sales_cancelled_at", null)
    .not("supplier_id", "is", null);
  if (dqErr) throw dqErr;

  const dqIds = new Set((dqAll ?? []).map((o) => o.id));

  console.log("=== PODSUMOWANIE ===");
  console.log("CSV wierszy (z ID):", csvRows.length);
  console.log("DB inwentaryzacja regału:", whIds.size);
  console.log("DB kolejka przyjęcia (Zamówione/Częściowo):", dqIds.size);

  const missingInDb = csvRows.filter((r) => !dbById.has(r.id));
  const statusMismatch: { id: string; csv: string; db: string; sales: string; product: string }[] = [];
  const csvInWh: string[] = [];
  const csvInDq: string[] = [];
  const csvNeither: {
    id: string;
    db: string;
    ack: string | null;
    cancelled: string | null;
    sales: string;
    product: string;
  }[] = [];

  const norm = (x: string) =>
    x
      ?.normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toUpperCase();

  for (const r of csvRows) {
    const db = dbById.get(r.id);
    if (!db) continue;

    const csvSt = norm(r.status ?? "");
    const dbSt = norm(db.status ?? "");
    if (csvSt !== dbSt && !(csvSt === "ZAMOWIONE" && dbSt === "ZAMOWIONE")) {
      statusMismatch.push({
        id: r.id.slice(0, 8),
        csv: r.status,
        db: db.status,
        sales: r.sales,
        product: (r.product ?? "").slice(0, 50),
      });
    }

    if (whIds.has(r.id)) csvInWh.push(r.id);
    else if (dqIds.has(r.id)) csvInDq.push(r.id);
    else
      csvNeither.push({
        id: r.id,
        db: db.status,
        ack: db.sales_acknowledged_at ?? null,
        cancelled: db.sales_cancelled_at ?? null,
        sales: r.sales,
        product: (r.product ?? "").slice(0, 55),
      });
  }

  console.log("\n=== CSV vs DB (te same ID) ===");
  console.log("Brak w bazie:", missingInDb.length);
  if (missingInDb.length) console.log(missingInDb.slice(0, 5));

  console.log("Różny status CSV vs DB:", statusMismatch.length);
  for (const m of statusMismatch) console.log(" ", m);

  console.log("CSV na regale (inwentaryzacja):", csvInWh.length);
  console.log("CSV w kolejce przyjęcia:", csvInDq.length);
  console.log("CSV poza oboma widokami magazynu:", csvNeither.length);
  for (const n of csvNeither) {
    console.log(
      `  ${n.id.slice(0, 8)}… ${n.db} ack=${n.ack ? "tak" : "nie"} cancel=${n.cancelled ? "tak" : "nie"} | ${n.sales} | ${n.product}`
    );
  }

  const csvIdSet = new Set(ids);
  const whNotInCsv = [...whIds].filter((id) => !csvIdSet.has(id));
  const dqNotInCsv = [...dqIds].filter((id) => !csvIdSet.has(id));

  console.log("\n=== DB vs CSV (brakuje w pliku) ===");
  console.log("Na regale, brak w CSV:", whNotInCsv.length);
  console.log("W kolejce przyjęcia, brak w CSV:", dqNotInCsv.length);

  if (whNotInCsv.length) {
    const { data: sp } = await s.from("sales_people").select("id, name");
    const spMap = new Map((sp ?? []).map((x) => [x.id, x.name]));
    const sample = whNotInCsv.slice(0, 15);
    const { data } = await s
      .from("individual_orders")
      .select("id, status, products, delivered_quantity, sales_person_id, warehouse_shelf")
      .in("id", sample);
    console.log("\nPróbka pozycji na regale NIE w CSV:");
    for (const o of data ?? []) {
      console.log(
        `  ${o.id.slice(0, 8)}… ${o.status} | ${spMap.get(o.sales_person_id) ?? "?"} | dost=${o.delivered_quantity} | ${(o.products ?? "").slice(0, 45)}`
      );
    }
  }

  // CSV says ZAMÓWIONE — expect delivery queue
  const csvZamowione = csvRows.filter((r) => norm(r.status) === "ZAMOWIONE");
  const zamInDq = csvZamowione.filter((r) => dqIds.has(r.id)).length;
  const zamNotInDq = csvZamowione.filter((r) => !dqIds.has(r.id) && dbById.has(r.id));
  console.log("\n=== OCZEKIWANIE (CSV = ZAMÓWIONE → kolejka przyjęcia) ===");
  console.log("CSV ZAMÓWIONE:", csvZamowione.length);
  console.log("z nich w kolejce przyjęcia:", zamInDq);
  console.log("z nich POZA kolejką:", zamNotInDq.length);
  for (const r of zamNotInDq) {
    const db = dbById.get(r.id)!;
    console.log(
      `  ${r.id.slice(0, 8)}… DB=${db.status} ack=${db.sales_acknowledged_at ? "Y" : "N"} | ${r.sales} | ${(r.product ?? "").slice(0, 50)}`
    );
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
