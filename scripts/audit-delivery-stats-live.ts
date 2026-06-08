/**
 * Audyt na żywo: delivery_stats vs historia zamówień.
 *   npx tsx scripts/audit-delivery-stats-live.ts
 */
import { fetchDeliveryStatsDiagnostics } from "../src/lib/data/delivery-stats-diagnostics";
import { createAdminClient, hasSupabaseConfig } from "../src/lib/supabase/admin";
import { aggregateDeliveryStatsFromOrders } from "../src/lib/orders/delivery-stats-aggregation";
import { DELIVERY_STATS_COMPLETED_STATUS } from "../src/lib/orders/delivery-stats-aggregation";
import { calculateBusinessDays, parseDateOnly } from "../src/lib/orders/dates";
import { orderPlacementAt } from "../src/lib/orders/order-timing";

async function main() {
  if (!hasSupabaseConfig()) {
    console.error("Brak konfiguracji Supabase (.env.local)");
    process.exit(1);
  }

  const diag = await fetchDeliveryStatsDiagnostics();
  if (!diag) {
    console.error("Nie udało się pobrać diagnostyki");
    process.exit(1);
  }

  const s = diag.summary;
  console.log("=== PODSUMOWANIE ===");
  console.log(JSON.stringify(s, null, 2));
  console.log("generatedAt:", diag.generatedAt);

  const byHealth: Record<string, number> = {};
  for (const row of diag.suppliers) {
    byHealth[row.health] = (byHealth[row.health] ?? 0) + 1;
  }
  console.log("\n=== STATUSY ===", byHealth);

  const withSamples = diag.suppliers.filter((r) => r.totalSamples > 0);
  console.log(`\n=== DOSTAWCY Z PRÓBKAMI (${withSamples.length}) — TOP 20 ===`);
  for (const r of withSamples.slice(0, 20)) {
    console.log(
      [
        r.supplierName.slice(0, 30).padEnd(30),
        `health=${r.health}`,
        `n=${r.totalSamples}`,
        `~${r.combinedAvg ?? "?"}d`,
        `gł=${r.mainAvg ?? "-"}(${r.recomputed.main_count})`,
        `pob=${r.sideAvg ?? "-"}(${r.recomputed.side_count})`,
        r.statsMode,
      ].join(" | ")
    );
  }

  const issues = diag.suppliers.filter((r) =>
    ["mismatch", "integrity", "missing_row"].includes(r.health)
  );
  console.log(`\n=== PROBLEMY (${issues.length}) ===`);
  for (const r of issues.slice(0, 30)) {
    console.log(`- ${r.supplierName} | ${r.health} | ${r.healthNotes.join("; ")}`);
    if (r.stored && r.recomputed) {
      console.log(
        `    DB: gł=${r.stored.main_avg}(${r.stored.main_count}) pob=${r.stored.side_avg}(${r.stored.side_count})`
      );
      console.log(
        `    hist: gł=${r.recomputed.main_avg}(${r.recomputed.main_count}) pob=${r.recomputed.side_avg}(${r.recomputed.side_count})`
      );
    }
  }

  // Realność: rozkład dni roboczych
  const allDays = withSamples.flatMap((r) => r.samples.map((x) => x.businessDays));
  if (allDays.length) {
    allDays.sort((a, b) => a - b);
    const median = allDays[Math.floor(allDays.length / 2)]!;
    const avg = Math.round(allDays.reduce((a, b) => a + b, 0) / allDays.length);
    const min = allDays[0]!;
    const max = allDays[allDays.length - 1]!;
    const over30 = allDays.filter((d) => d > 30).length;
    const zero = allDays.filter((d) => d === 0).length;
    console.log("\n=== REALNOŚĆ PRÓBEK (dni robocze) ===");
    console.log(`Liczba próbek: ${allDays.length}`);
    console.log(`Min/mediana/średnia/max: ${min} / ${median} / ${avg} / ${max} dni`);
    console.log(`Same-day (0 dni): ${zero}`);
    console.log(`>30 dni: ${over30} (${((over30 / allDays.length) * 100).toFixed(1)}%)`);
  }

  // Ręczna weryfikacja 3 losowych próbek
  const supabase = createAdminClient();
  const verifyTargets = withSamples
    .filter((r) => r.health === "ok" || r.health === "low_samples")
    .flatMap((r) => r.samples.slice(0, 1).map((s) => ({ supplier: r.supplierName, sample: s })))
    .slice(0, 5);

  console.log("\n=== WERYFIKACJA RĘCZNA (5 próbek vs DB) ===");
  for (const { supplier, sample } of verifyTargets) {
    const { data: order } = await supabase
      .from("individual_orders")
      .select("id, ordered_at, action_at, status, delivery_at, order_type, products, request_kind")
      .eq("id", sample.orderId)
      .maybeSingle();

    if (!order) {
      console.log(`FAIL ${supplier} ${sample.orderId}: brak zamówienia w DB`);
      continue;
    }

    const placement = orderPlacementAt(order);
    const orderDate = placement ? parseDateOnly(placement) : null;
    const deliveryDate = parseDateOnly(order.delivery_at);
    const recomputedDays =
      orderDate && deliveryDate ? calculateBusinessDays(orderDate, deliveryDate) : null;

    const ok =
      order.status === DELIVERY_STATS_COMPLETED_STATUS &&
      recomputedDays === sample.businessDays &&
      sample.placementDate === orderDate?.toISOString().slice(0, 10);

    console.log(
      `${ok ? "OK" : "WARN"} ${supplier.slice(0, 20)} | order ${sample.orderId.slice(0, 8)}… | ` +
        `placement ${sample.placementDate} → delivery ${sample.deliveryDate} | ` +
        `sample=${sample.businessDays}d recomputed=${recomputedDays}d status=${order.status}`
    );
  }

  // Czy stats pochodzą z importu czy z live
  const { data: statsRows } = await supabase.from("delivery_stats").select("updated_at").limit(500);
  const { count: orderCount } = await supabase
    .from("individual_orders")
    .select("id", { count: "exact", head: true })
    .eq("request_kind", "zamowienie")
    .eq("status", DELIVERY_STATS_COMPLETED_STATUS);

  console.log("\n=== KONTEKST ===");
  console.log(`Zrealizowanych zamówień w historii: ${orderCount ?? "?"}`);
  console.log(`Wierszy delivery_stats: ${s?.suppliersWithStoredStats ?? "?"}`);
  console.log(
    `Dostawcy z próbkami z historii: ${s?.suppliersWithSamples ?? "?"} / ${s?.supplierCount ?? "?"}`
  );

  if (issues.length === 0 && withSamples.length > 0) {
    console.log("\n✓ Dane spójne z historią — brak rozjazdów mismatch/integrity/missing_row");
  } else if (withSamples.length === 0) {
    console.log("\n⚠ Brak próbek w historii — ETA będzie puste do pierwszych pełnych realizacji");
  } else {
    console.log(`\n⚠ ${issues.length} dostawców wymaga uwagi — rozważ „Przelicz statystyki ETA”`);
  }

  // --- głębsza analiza ---
  const ok = diag.suppliers
    .filter((r) => r.health === "ok")
    .sort((a, b) => b.totalSamples - a.totalSamples);
  console.log(`\n=== OK (≥3 próbki): ${ok.length} ===`);
  for (const r of ok.slice(0, 15)) {
    const dbMatch =
      r.stored &&
      r.recomputed.main_count === (r.stored.main_count ?? 0) &&
      r.recomputed.main_avg === r.stored.main_avg &&
      r.recomputed.side_count === (r.stored.side_count ?? 0) &&
      r.recomputed.side_avg === r.stored.side_avg;
    console.log(
      `${r.supplierName.slice(0, 32).padEnd(32)} n=${r.totalSamples} ~${r.combinedAvg}d ${dbMatch ? "DB=hist" : "DB!=hist"} ${r.statsMode}`
    );
  }

  const allSamples = diag.suppliers.flatMap((r) =>
    r.samples.map((s) => ({ ...s, supplier: r.supplierName }))
  );

  console.log("\n=== OUTLIERS: same-day (0 dni) ===");
  for (const s of allSamples.filter((x) => x.businessDays === 0)) {
    console.log(`  ${s.supplier} | ${s.placementDate} → ${s.deliveryDate} | ${s.orderType}`);
  }

  console.log("\n=== OUTLIERS: >30 dni ===");
  for (const s of allSamples
    .filter((x) => x.businessDays > 30)
    .sort((a, b) => b.businessDays - a.businessDays)) {
    console.log(`  ${s.businessDays}d | ${s.supplier} | ${s.placementDate} → ${s.deliveryDate}`);
  }

  const buckets: Record<string, number> = {
    "0": 0,
    "1-2": 0,
    "3-5": 0,
    "6-10": 0,
    "11-20": 0,
    "21+": 0,
  };
  for (const s of allSamples) {
    const d = s.businessDays;
    if (d === 0) buckets["0"]++;
    else if (d <= 2) buckets["1-2"]++;
    else if (d <= 5) buckets["3-5"]++;
    else if (d <= 10) buckets["6-10"]++;
    else if (d <= 20) buckets["11-20"]++;
    else buckets["21+"]++;
  }
  console.log("\n=== ROZKŁAD DNI ROBOCZYCH ===", buckets);

  const { data: orders } = await supabase
    .from("individual_orders")
    .select(
      "id, supplier_id, request_kind, status, ordered_at, action_at, delivery_at, order_type, products"
    )
    .eq("request_kind", "zamowienie")
    .eq("status", DELIVERY_STATS_COMPLETED_STATUS);
  const { skipped } = aggregateDeliveryStatsFromOrders(orders ?? []);
  const reasons: Record<string, number> = {};
  for (const row of skipped) {
    reasons[row.reason] = (reasons[row.reason] ?? 0) + 1;
  }
  console.log("\n=== POWODY POMINIĘCIA (723 → 419 próbek) ===", reasons);

  // outlier deep dive
  for (const namePattern of ["Giedrius", "IPD POLAND", "Denon Dental"]) {
    const { data: supplier } = await supabase
      .from("suppliers")
      .select("id, name, stats_mode")
      .ilike("name", `%${namePattern}%`)
      .limit(1)
      .maybeSingle();
    if (!supplier) continue;
    console.log(`\n=== DEEP: ${supplier.name} ===`);
    const { data: stats } = await supabase
      .from("delivery_stats")
      .select("*")
      .eq("supplier_id", supplier.id)
      .maybeSingle();
    console.log("delivery_stats:", stats);
    const { data: ordersForSup } = await supabase
      .from("individual_orders")
      .select("products, ordered_at, action_at, delivery_at, order_type")
      .eq("supplier_id", supplier.id)
      .eq("status", DELIVERY_STATS_COMPLETED_STATUS)
      .order("delivery_at", { ascending: true });
    const { samples: supSamples } = aggregateDeliveryStatsFromOrders(
      (ordersForSup ?? []).map((o, i) => ({
        id: `row-${i}`,
        supplier_id: supplier.id,
        request_kind: "zamowienie",
        status: DELIVERY_STATS_COMPLETED_STATUS,
        ordered_at: o.ordered_at,
        action_at: o.action_at ?? "",
        delivery_at: o.delivery_at,
        order_type: o.order_type,
        products: o.products,
      }))
    );
    console.log(`Zrealizowanych: ${ordersForSup?.length ?? 0}, próbek: ${supSamples.length}`);
    for (const smp of supSamples) {
      console.log(
        `  ${smp.businessDays}d ${smp.orderType} ${smp.placementDate} → ${smp.deliveryDate}`
      );
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
