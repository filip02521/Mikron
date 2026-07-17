import type { SupabaseClient } from "@supabase/supabase-js";
import { isProcurementDraftReady } from "@/lib/orders/procurement-readiness";
import { isTeethZamowienie } from "@/lib/teeth/teeth-lifecycle";
import type { IndividualOrderStatus, IndividualRequestKind, IndividualOrder } from "@/types/database";
import { fetchTeethProductInfo } from "@/lib/data/teeth-products";
import { fetchSuppliersForForm } from "@/lib/data/queries";
import { resolveSupplierForTeethManufacturer } from "@/lib/orders/teeth-ocr-prosba-prefill";

const REPAIR_STATUSES: IndividualOrderStatus[] = [
  "Nowe",
  "Zamowione",
  "Czesciowo_zrealizowane",
];

/** Zęby w statusie Weryfikacja → Nowe (tor zębów, nie /weryfikacja). Pomija OCR oczekujące w /zeby/weryfikacja. */
export async function repairTeethOrdersFromVerification(
  supabase: SupabaseClient
): Promise<number> {
  const { data, error } = await supabase
    .from("individual_orders")
    .select("id, subiekt_tw_id, supplier_id")
    .eq("is_teeth", true)
    .eq("status", "Weryfikacja")
    .eq("teeth_ocr_pending", false);

  if (error) throw new Error(error.message);
  const ids = (data ?? []).map((r) => String(r.id));
  if (!ids.length) return 0;

  // Auto-przypisz dostawcę dla zębów bez supplier_id na podstawie producenta
  const teethProducts = await fetchTeethProductInfo().catch(() => []);
  const manufacturerByTwId = new Map(teethProducts.map((row) => [row.twId, row.manufacturer]));
  const ordersWithoutSupplier = (data ?? []).filter((r) => !r.supplier_id);
  if (ordersWithoutSupplier.length > 0) {
    const suppliers = await fetchSuppliersForForm().catch(() => [] as Array<{ id: string; name: string }>);
    for (const row of ordersWithoutSupplier) {
      const twId = row.subiekt_tw_id != null && row.subiekt_tw_id > 0
        ? Math.trunc(row.subiekt_tw_id)
        : null;
      if (!twId) continue;
      const manufacturer = manufacturerByTwId.get(twId);
      if (!manufacturer) continue;
      const resolvedSupplierId = resolveSupplierForTeethManufacturer(manufacturer, suppliers);
      if (resolvedSupplierId) {
        await supabase
          .from("individual_orders")
          .update({ supplier_id: resolvedSupplierId })
          .eq("id", row.id);
      }
    }
  }

  const { error: updErr } = await supabase
    .from("individual_orders")
    .update({ status: "Nowe" })
    .in("id", ids);

  if (updErr) throw new Error(updErr.message);
  return ids.length;
}

/** Niekompletne prośby → Weryfikacja; nie trafiają do kolejki dostaw. */
export async function repairIncompleteIndividualOrders(
  supabase: SupabaseClient
): Promise<number> {
  const { data, error } = await supabase
    .from("individual_orders")
    .select(
      "id, supplier_id, symbol, products, mikran_code, quantity, request_kind, status, is_teeth"
    )
    .eq("request_kind", "zamowienie")
    .in("status", REPAIR_STATUSES);

  if (error) throw new Error(error.message);

  const toFix = (data ?? []).filter((r) => {
    if (isTeethZamowienie(r as IndividualOrder)) return false;
    const kind = (r.request_kind ?? "zamowienie") as IndividualRequestKind;
    return !isProcurementDraftReady({
      supplierId: r.supplier_id ?? undefined,
      symbol: r.symbol ?? undefined,
      mikranCode: r.mikran_code ?? undefined,
      product: r.products ?? undefined,
      quantity: r.quantity ?? undefined,
      requestKind: kind,
    });
  });
  if (!toFix.length) return 0;

  const ids = toFix.map((r) => r.id);
  const { error: updErr } = await supabase
    .from("individual_orders")
    .update({ status: "Weryfikacja" })
    .in("id", ids);

  if (updErr) throw new Error(updErr.message);
  return ids.length;
}
