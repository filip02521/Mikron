/**
 * Audyt ZD ETA: porównanie bazy vs Subiekt, limity diagnostyki vs pełny sync.
 *
 *   export $(grep -v '^#' .env.local | grep -E 'SUBIEKT|SUPABASE' | xargs)
 *   npx tsx scripts/audit-zd-eta.ts [sales_person_id]
 */
import { createAdminClient } from "../src/lib/supabase/admin";
import { normalizeIndividualOrders } from "../src/lib/data/normalize-order";
import { loadAppSupplierRefsWithAliases } from "../src/lib/data/supplier-subiekt-kh";
import { diagnoseZdEtaCandidates, diagnoseZdEtaForOrder } from "../src/lib/subiekt/zd-eta-diagnose";
import { getSubiektZdDocumentCached } from "../src/lib/subiekt/subiekt-runtime-cache";
import {
  isActiveZdFulfillmentDocument,
  parseZdFulfillmentDeadline,
} from "../src/lib/subiekt/zd-fulfillment-date";
import { findBestMatchingZdDocument } from "../src/lib/subiekt/match-order-to-zd";
import { resolveSupplierKhIds, runZdEtaSync } from "../src/lib/subiekt/zd-eta-sync";
import { isSubiektReachable } from "../src/lib/subiekt/availability";
import type { IndividualOrder } from "../types/database";

const salesPersonId =
  process.argv[2]?.trim() || "bd627351-6b4c-4d60-ad7d-5c65f0e9c66f";

async function fetchOpenOrders(spId: string): Promise<IndividualOrder[]> {
  const supabase = createAdminClient();
  const res = await supabase
    .from("individual_orders")
    .select("*, supplier:suppliers(*)")
    .eq("sales_person_id", spId)
    .in("status", ["Zamowione", "Czesciowo_zrealizowane"])
    .eq("request_kind", "zamowienie")
    .is("sales_acknowledged_at", null)
    .order("action_at", { ascending: false });
  if (res.error) throw new Error(res.error.message);
  return normalizeIndividualOrders(res.data ?? []);
}

async function verifyDbVsSubiekt(orders: IndividualOrder[]) {
  console.log("\n=== 1. Baza vs Subiekt (zapisane ETA) ===\n");
  console.log(
    "Symbol".padEnd(18),
    "DB termin".padEnd(12),
    "DB ZD".padEnd(22),
    "Sub termin".padEnd(12),
    "Sub ZD".padEnd(22),
    "Status",
    "OK?"
  );
  console.log("-".repeat(110));

  let ok = 0;
  let missing = 0;
  let mismatch = 0;

  for (const order of orders) {
    const dbDeadline = order.zd_fulfillment_deadline ?? "-";
    const dbNr = order.zd_fulfillment_dok_nr ?? "-";
    const dokId = order.zd_fulfillment_dok_id;

    if (!dokId) {
      missing++;
      console.log(
        (order.symbol ?? "-").padEnd(18),
        dbDeadline.padEnd(12),
        dbNr.padEnd(22),
        "-".padEnd(12),
        "-".padEnd(22),
        "-",
        dbDeadline !== "-" ? "STALE?" : "brak"
      );
      continue;
    }

    const doc = await getSubiektZdDocumentCached(dokId);
    if (!doc) {
      mismatch++;
      console.log(
        (order.symbol ?? "-").padEnd(18),
        dbDeadline.padEnd(12),
        dbNr.padEnd(22),
        "LOAD FAIL".padEnd(12),
        "-".padEnd(22),
        "-",
        "ERR"
      );
      continue;
    }

    const subDeadline = parseZdFulfillmentDeadline(doc) ?? "-";
    const subNr = doc.dok_NrPelny?.trim() ?? "-";
    const active = isActiveZdFulfillmentDocument(doc);
    const datesOk = dbDeadline === subDeadline;
    const nrOk = dbNr === subNr || dbNr.includes(subNr) || subNr.includes(dbNr);
    const allOk = datesOk && nrOk && active;

    if (allOk) ok++;
    else mismatch++;

    console.log(
      (order.symbol ?? "-").padEnd(18),
      dbDeadline.padEnd(12),
      dbNr.padEnd(22),
      subDeadline.padEnd(12),
      subNr.padEnd(22),
      String(doc.dok_Status ?? "?"),
      allOk ? "OK" : `FAIL${!datesOk ? " date" : ""}${!nrOk ? " nr" : ""}${!active ? " inactive" : ""}`
    );
  }

  console.log("-".repeat(110));
  console.log(`Zapisane: ${orders.filter((o) => o.zd_fulfillment_dok_id).length}, OK: ${ok}, mismatch: ${mismatch}, brak w DB: ${missing}`);
}

async function loadKhContext() {
  const suppliers = await loadAppSupplierRefsWithAliases();
  const supplierById = new Map(suppliers.map((s) => [s.id, s]));
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("subiekt_zd_index")
    .select("supplier_id, subiekt_kh_id")
    .not("supplier_id", "is", null);
  if (error) throw new Error(error.message);
  const extraKhBySupplierId = new Map<string, number[]>();
  for (const row of data ?? []) {
    const supplierId = (row as { supplier_id: string | null }).supplier_id;
    const kh = Math.trunc(Number((row as { subiekt_kh_id: number }).subiekt_kh_id));
    if (!supplierId || !Number.isFinite(kh) || kh <= 0) continue;
    const set = new Set(extraKhBySupplierId.get(supplierId) ?? []);
    set.add(kh);
    extraKhBySupplierId.set(supplierId, [...set]);
  }
  return { supplierById, extraKhBySupplierId };
}

function khIdsForOrder(
  order: IndividualOrder,
  supplierById: Map<string, Awaited<ReturnType<typeof loadAppSupplierRefsWithAliases>>[number]>,
  extraKhBySupplierId: Map<string, number[]>
): number[] {
  if (!order.supplier_id) return [];
  const supplier = supplierById.get(order.supplier_id);
  return resolveSupplierKhIds(supplier, order.supplier_id, extraKhBySupplierId);
}

async function diagnoseLimits(
  orders: IndividualOrder[],
  supplierById: Map<string, Awaited<ReturnType<typeof loadAppSupplierRefsWithAliases>>[number]>,
  extraKhBySupplierId: Map<string, number[]>
) {
  console.log("\n=== 2. Diagnostyka — limit 24 vs 192 docs/order ===\n");

  const limits = [
    { label: "default (24)", maxDocs: 24 },
    { label: "extended (192)", maxDocs: 192 },
  ];

  for (const lim of limits) {
    let matched = 0;
    let incomplete = 0;
    const rows: string[] = [];

    for (const order of orders) {
      const khIds = khIdsForOrder(order, supplierById, extraKhBySupplierId);
      const supplier = order.supplier_id ? supplierById.get(order.supplier_id) : undefined;
      const d = await diagnoseZdEtaForOrder(order, supplier, khIds, {
        maxDocsPerOrder: lim.maxDocs,
      });
      if (d.deadline) matched++;
      if (d.incomplete) incomplete++;
      rows.push(
        `${d.symbol.padEnd(16)} ${d.method.padEnd(7)} ${(d.deadline ?? "-").padEnd(12)} docs=${String(d.docsFetched).padEnd(3)} ${d.incomplete ? "INCOMPLETE" : ""} ${d.note ?? ""}`
      );
    }

    console.log(`--- ${lim.label} ---`);
    for (const r of rows) console.log(r);
    console.log(`Matched: ${matched}/${orders.length}, incomplete: ${incomplete}\n`);
  }
}

async function freshDiagnoseAll() {
  console.log("\n=== 3. diagnoseZdEtaCandidates (maxOrders=48, maxDocs=48) ===\n");
  const rows = await diagnoseZdEtaCandidates({
    salesPersonId,
    maxOrders: 48,
    maxDocsPerOrder: 48,
  });
  let matched = 0;
  let incomplete = 0;
  for (const row of rows) {
    if (row.deadline) matched++;
    if (row.incomplete) incomplete++;
    console.log(
      row.supplier.padEnd(16),
      row.symbol.padEnd(16),
      row.method.padEnd(7),
      (row.deadline ?? "-").padEnd(12),
      `idx=${row.indexCandidates}`.padEnd(6),
      `docs=${row.docsFetched}`.padEnd(8),
      row.incomplete ? "INCOMPLETE" : "",
      row.note ?? ""
    );
  }
  console.log(`\nPozycji: ${rows.length}, z terminem: ${matched}, niepełne: ${incomplete}`);
  return { matched, incomplete, total: rows.length };
}

async function verifyMatchesAgainstSubiekt(
  orders: IndividualOrder[],
  supplierById: Map<string, Awaited<ReturnType<typeof loadAppSupplierRefsWithAliases>>[number]>,
  extraKhBySupplierId: Map<string, number[]>
) {
  console.log("\n=== 4. Weryfikacja dopasowań (diagnose vs pełny dokument Subiekt) ===\n");
  for (const order of orders) {
    const khIds = khIdsForOrder(order, supplierById, extraKhBySupplierId);
    const supplier = order.supplier_id ? supplierById.get(order.supplier_id) : undefined;
    const d = await diagnoseZdEtaForOrder(order, supplier, khIds, { maxDocsPerOrder: 192 });

    if (!d.dokId) {
      console.log(`${order.symbol}: brak dopasowania (${d.docsFetched} docs, ${d.note ?? ""})`);
      continue;
    }

    const doc = await getSubiektZdDocumentCached(d.dokId);
    if (!doc) {
      console.log(`${order.symbol}: dok ${d.dokId} — nie załadowano`);
      continue;
    }

    const best = findBestMatchingZdDocument(order, [doc]);
    const deadline = parseZdFulfillmentDeadline(doc);
    const active = isActiveZdFulfillmentDocument(doc);
    const syms =
      doc.pozycje?.map((p) => p.tw_Symbol ?? p.ob_Towar?.tw_Symbol).filter(Boolean) ?? [];

    console.log({
      symbol: order.symbol,
      method: d.method,
      dokNr: doc.dok_NrPelny,
      status: doc.dok_Status,
      diagnoseDeadline: d.deadline,
      subiektDeadline: deadline,
      match: best ? "YES" : "NO",
      active,
      lineSyms: syms.slice(0, 4),
      docsFetched: d.docsFetched,
    });
  }
}

async function fullSyncDryRun() {
  console.log("\n=== 5. runZdEtaSync force (bez zapisu — tylko statystyki po sync) ===\n");
  const supplierRefs = await loadAppSupplierRefsWithAliases();
  const before = await fetchOpenOrders(salesPersonId);
  const withEtaBefore = before.filter((o) => o.zd_fulfillment_deadline).length;

  const result = await runZdEtaSync({
    salesPersonId,
    force: true,
    allowLiveSearch: true,
    supplierRefs,
    maxOrders: 48,
    maxDocsPerRun: 200,
    maxDocsPerSupplier: 48,
    maxDurationMs: 180_000,
  });

  const after = await fetchOpenOrders(salesPersonId);
  const withEtaAfter = after.filter((o) => o.zd_fulfillment_deadline).length;

  console.log("Sync result:", JSON.stringify(result, null, 2));
  console.log(`ETA w bazie: przed ${withEtaBefore} → po ${withEtaAfter} (z ${before.length} otwartych)`);
}

async function main() {
  if (!(await isSubiektReachable())) {
    console.error("Subiekt niedostępny — audyt wymaga LAN.");
    process.exit(1);
  }

  const orders = await fetchOpenOrders(salesPersonId);
  const { supplierById, extraKhBySupplierId } = await loadKhContext();
  console.log(`Audyt ZD ETA — handlowiec: ${salesPersonId}`);
  console.log(`Otwartych prośb (Zamowione/Częściowo): ${orders.length}`);

  await verifyDbVsSubiekt(orders);
  await diagnoseLimits(orders, supplierById, extraKhBySupplierId);
  await freshDiagnoseAll();
  await verifyMatchesAgainstSubiekt(orders, supplierById, extraKhBySupplierId);
  await fullSyncDryRun();
  await verifyDbVsSubiekt(await fetchOpenOrders(salesPersonId));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
