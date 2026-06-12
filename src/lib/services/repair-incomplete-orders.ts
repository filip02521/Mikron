import type { SupabaseClient } from "@supabase/supabase-js";
import { isProcurementDraftReady } from "@/lib/orders/procurement-readiness";
import type { IndividualOrderStatus, IndividualRequestKind } from "@/types/database";

const REPAIR_STATUSES: IndividualOrderStatus[] = [
  "Nowe",
  "Zamowione",
  "Czesciowo_zrealizowane",
];

/** Niekompletne prośby → Weryfikacja; nie trafiają do kolejki dostaw. */
export async function repairIncompleteIndividualOrders(
  supabase: SupabaseClient
): Promise<number> {
  const { data, error } = await supabase
    .from("individual_orders")
    .select("id, supplier_id, symbol, products, mikran_code, quantity, request_kind, status")
    .eq("request_kind", "zamowienie")
    .in("status", REPAIR_STATUSES);

  if (error) throw new Error(error.message);

  const toFix = (data ?? []).filter((r) => {
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
