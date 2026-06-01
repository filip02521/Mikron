/**
 * Audyt zakładki Magazyn i regał (/kolejka).
 * Uruchom: npx tsx --env-file=.env.local scripts/audit-warehouse-tab.ts
 */
import {
  countDeliveryQueue,
  countInformacjaQueue,
  countPickupReadyForSales,
  fetchDeliveryQueue,
  fetchInformacjaQueue,
  fetchWarehouseInventory,
} from "../src/lib/data/queries";
import { mergeReceiveQueueOrders } from "../src/lib/orders/receive-queue";
import { summarizeQueueInbox } from "../src/lib/orders/queue-inbox";
import { buildWarehouseInventoryRows, summarizeWarehouseInventory } from "../src/lib/orders/warehouse-inventory";
import {
  getEmailDomain,
  getEmailFromAddress,
  isEmailConfigured,
} from "../src/lib/env/email-config";
import { createAdminClient, hasSupabaseConfig } from "../src/lib/supabase/admin";
import { resolveSalesPersonEmail } from "../src/lib/orders/resolve-sales-person-email";
import { normalizeIndividualOrder } from "../src/lib/data/normalize-order";

async function main() {
  console.log("=== Audyt: Magazyn i regał ===\n");

  if (!hasSupabaseConfig()) {
    console.error("Brak konfiguracji Supabase.");
    process.exit(1);
  }

  const emailOk = isEmailConfigured();
  const emailFrom = getEmailFromAddress();
  const emailOverride = process.env.EMAIL_OVERRIDE_TO?.trim();
  console.log("E-mail (Resend):");
  console.log(`  skonfigurowany: ${emailOk ? "TAK" : "NIE (RESEND_API_KEY)"}`);
  console.log(`  domena (EMAIL_DOMAIN): ${getEmailDomain() ?? "(brak)"}`);
  console.log(`  nadawca: ${emailFrom}`);
  console.log(`  EMAIL_OVERRIDE_TO: ${emailOverride ?? "(brak — maile idą do handlowców)"}`);
  console.log();

  const [delivery, informacja, pickupReady, inventory] = await Promise.all([
    fetchDeliveryQueue(),
    fetchInformacjaQueue(),
    countPickupReadyForSales(),
    fetchWarehouseInventory(),
  ]);

  const merged = mergeReceiveQueueOrders(delivery, informacja);
  const inbox = summarizeQueueInbox(delivery, informacja);
  const invRows = buildWarehouseInventoryRows(inventory);
  const invSummary = summarizeWarehouseInventory(invRows);

  console.log("Kolejka przyjęcia:");
  console.log(`  zamówienia (dostawa): ${delivery.length}`);
  console.log(`  informacje: ${informacja.length}`);
  console.log(`  po merge (wyświetlane): ${merged.length}`);
  console.log(`  częściowo: ${inbox.partialCount}, rezygnacja: ${inbox.cancelLabelledCount}`);
  console.log();

  console.log("Regał / odbiór:");
  console.log(`  gotowe do odbioru (handlowcy): ${pickupReady}`);
  console.log(`  inwentaryzacja (wiersze): ${invRows.length}`);
  console.log(`  ≥3 dni bez odbioru: ${invSummary.staleWarn}, krytyczne: ${invSummary.staleCritical}`);
  console.log(`  bez regału: ${invSummary.unassignedShelf}`);
  console.log();

  const supabase = createAdminClient();
  const { count: journalToday } = await supabase
    .from("warehouse_delivery_receipts")
    .select("id", { count: "exact", head: true })
    .gte("received_at", new Date().toISOString().slice(0, 10));

  console.log(`Dziennik dostaw (dziś): ${journalToday ?? 0} wpisów`);
  console.log();

  const sample = [...delivery.slice(0, 3), ...informacja.slice(0, 3)];
  if (sample.length) {
    console.log("Próbka handlowców (czy mają e-mail do powiadomień):");
    const seen = new Set<string>();
    for (const raw of sample) {
      if (seen.has(raw.sales_person_id)) continue;
      seen.add(raw.sales_person_id);
      const contact = await resolveSalesPersonEmail(supabase, raw);
      const kind = raw.request_kind === "informacja" ? "info" : "zam";
      console.log(
        `  ${raw.sales_person?.name ?? "?"} [${kind}]: ${contact?.email ?? "BRAK E-MAILA"}`
      );
    }
    console.log();
  }

  const { data: noEmailQueue } = await supabase
    .from("individual_orders")
    .select("id, sales_person_id, sales_person:sales_people(name, email)")
    .in("status", ["Zamowione", "Czesciowo_zrealizowane", "Nowe"])
    .is("sales_cancelled_at", null)
    .limit(200);

  const missingEmailIds: string[] = [];
  for (const row of noEmailQueue ?? []) {
    const order = normalizeIndividualOrder(row as never);
    const c = await resolveSalesPersonEmail(supabase, order);
    if (!c?.email) missingEmailIds.push(order.id);
  }
  if (missingEmailIds.length) {
    console.log(`⚠ ${missingEmailIds.length} pozycji w kolejce (próbka 200) bez e-maila handlowca — zapis bez powiadomienia.`);
  } else {
    console.log("✓ W próbce kolejki wszyscy handlowcy mają e-mail.");
  }

  console.log("\n=== Koniec audytu ===");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
