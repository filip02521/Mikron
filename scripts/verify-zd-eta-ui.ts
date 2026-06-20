import { createAdminClient } from "../src/lib/supabase/admin";
import { fetchDeliveryStats } from "../src/lib/data/queries";
import { normalizeIndividualOrders } from "../src/lib/data/normalize-order";
import { presentMyOrders } from "../src/lib/orders/my-order-presenter";
import {
  buildSupplierKhIdsBySupplierId,
  loadAppSupplierRefsWithAliases,
} from "../src/lib/data/supplier-subiekt-kh";
import { buildMyOrderDeliveryTimingDisplay } from "../src/lib/orders/my-order-delivery-timing-display";

const salesPersonId =
  process.argv[2]?.trim() || "4e0c3e1f-b58d-443a-88a3-81162e6fe392";

const symbols = [
  "606402",
  "H364RXE 103 015",
  "FILTR V10",
  "0877",
  "4000-O",
  "FCE06SIN0005",
  "DL.101.030",
];

async function main() {
  const supabase = createAdminClient();
  const { data: orders } = await supabase
    .from("individual_orders")
    .select("*, supplier:suppliers(*)")
    .eq("sales_person_id", salesPersonId)
    .in("status", ["Zamowione", "Czesciowo_zrealizowane"])
    .is("sales_acknowledged_at", null);

  const normalized = normalizeIndividualOrders(orders ?? []);
  const refs = await loadAppSupplierRefsWithAliases();
  const khLookup = buildSupplierKhIdsBySupplierId(refs);
  const stats = await fetchDeliveryStats();
  const { zamowienia: rows } = presentMyOrders(normalized, stats, {
    supplierKhIdsBySupplierId: khLookup,
    subiektReachable: true,
  });

  console.log("=== BAZA (zd_fulfillment_*) ===");
  for (const sym of symbols) {
    const o = normalized.find((x) => x.symbol === sym);
    if (!o) {
      console.log(`${sym.padEnd(20)} — brak w puli`);
      continue;
    }
    console.log(
      `${sym.padEnd(20)} ${(o.zd_fulfillment_dok_nr ?? "-").padEnd(22)} ${o.zd_fulfillment_deadline ?? "-"}`
    );
  }

  console.log("\n=== UI (/moje presenter) ===");
  for (const sym of symbols) {
    const row = rows.find((r) => r.lines.some((l) => l.symbol === sym));
    if (!row) {
      console.log(`${sym.padEnd(20)} — brak karty`);
      continue;
    }
    const timing = buildMyOrderDeliveryTimingDisplay(row);
    console.log(
      `${sym.padEnd(20)} ${(row.timingLabel ?? "-").slice(0, 45).padEnd(45)} pending=${String(row.zdEtaPending).padEnd(5)} noMatch=${String(row.zdEtaNoMatch).padEnd(5)} ${timing?.title ?? "-"}`
    );
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
