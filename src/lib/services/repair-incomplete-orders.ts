import type { SupabaseClient } from "@supabase/supabase-js";
import { isProcurementDraftReady } from "@/lib/orders/procurement-readiness";
import { isTeethZamowienie } from "@/lib/teeth/teeth-lifecycle";
import type { IndividualOrderStatus, IndividualRequestKind, IndividualOrder } from "@/types/database";

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
    .select("id")
    .eq("is_teeth", true)
    .eq("status", "Weryfikacja")
    .eq("teeth_ocr_pending", false);

  if (error) throw new Error(error.message);
  const ids = (data ?? []).map((r) => String(r.id));
  if (!ids.length) return 0;

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
