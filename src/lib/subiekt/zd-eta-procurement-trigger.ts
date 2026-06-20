import { runZdEtaSyncForSalesPerson } from "@/lib/subiekt/zd-eta-sync";
import type { IndividualOrder } from "@/types/database";

/** Handlowcy z prośbami oznaczonymi jako Zamowione — kwalifikują się do sync ZD. */
export function collectZdEtaSyncSalesPersonIds(
  orders: Pick<IndividualOrder, "sales_person_id" | "request_kind">[]
): string[] {
  const ids = new Set<string>();
  for (const order of orders) {
    if (order.request_kind === "informacja") continue;
    const id = order.sales_person_id?.trim();
    if (id) ids.add(id);
  }
  return [...ids];
}

export async function runZdEtaSyncForSalesPeople(
  salesPersonIds: readonly string[]
): Promise<{ updated: number; processed: number }> {
  const unique = [...new Set(salesPersonIds.map((id) => id.trim()).filter(Boolean))];
  let updated = 0;
  let processed = 0;

  for (const salesPersonId of unique) {
    try {
      const result = await runZdEtaSyncForSalesPerson(salesPersonId, {
        allowLiveSearch: true,
      });
      if (result.skipped) continue;
      updated += result.updated;
      processed += result.processed;
    } catch (e) {
      console.error("[runZdEtaSyncForSalesPeople]", salesPersonId, e);
    }
  }

  return { updated, processed };
}

/** Po oznaczeniu prośb jako Zamowione — sync terminów ZD w tle (live search). */
export async function scheduleZdEtaSyncAfterProcurement(
  salesPersonIds: readonly string[]
): Promise<void> {
  const unique = [...new Set(salesPersonIds.map((id) => id.trim()).filter(Boolean))];
  if (!unique.length) return;

  const { after } = await import("next/server");
  after(async () => {
    const { updated } = await runZdEtaSyncForSalesPeople(unique);
    if (updated > 0) {
      const { revalidatePath } = await import("next/cache");
      revalidatePath("/moje");
    }
  });
}
