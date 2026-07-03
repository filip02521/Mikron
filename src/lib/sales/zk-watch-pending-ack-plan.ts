import { revalidatePath } from "next/cache";
import { isSalesCancelNoticePending } from "@/lib/orders/sales-cancel";
import {
  getSalesCancelDbCaps,
  SALES_CANCEL_MIGRATION_HINT,
  salesCancelAckSelect,
} from "@/lib/orders/sales-cancel-db";
import {
  groupZkWatchPendingAckOrderIdsByKind,
  type ZkWatchPendingAckItem,
} from "@/lib/sales/zk-watch-close-pending";
import type { IndividualOrder, IndividualOrderStatus, SalesZkWatch } from "@/types/database";
import type { SupabaseClient } from "@supabase/supabase-js";

export type AckOptions = {
  allowedStatuses?: IndividualOrderStatus[];
  requireSalesCancelled?: boolean;
};

export type AckMutationResult = { count: number; ackedIds: string[] };

function revalidateSalesOrderPaths() {
  revalidatePath("/moje");
  revalidatePath("/zespol");
  revalidatePath("/notatnik");
  revalidatePath("/zk");
}

export async function rollbackZkWatchPendingAck(
  supabase: SupabaseClient,
  salesPersonId: string,
  rolledBack: { zdDeadlineIds: string[]; salesAckIds: string[] }
) {
  if (rolledBack.zdDeadlineIds.length) {
    const { error } = await supabase
      .from("individual_orders")
      .update({ zd_fulfillment_deadline_change_seen_at: null })
      .in("id", rolledBack.zdDeadlineIds)
      .eq("sales_person_id", salesPersonId);
    if (error) throw new Error(error.message);
  }

  if (!rolledBack.salesAckIds.length) return;

  const caps = await getSalesCancelDbCaps(supabase);
  const { data: rowsRaw, error: fetchError } = await supabase
    .from("individual_orders")
    .select(salesCancelAckSelect(caps))
    .in("id", rolledBack.salesAckIds)
    .eq("sales_person_id", salesPersonId);

  if (fetchError) throw new Error(fetchError.message);

  const { error } = await supabase
    .from("individual_orders")
    .update({ sales_acknowledged_at: null })
    .in("id", rolledBack.salesAckIds)
    .eq("sales_person_id", salesPersonId);

  if (error) throw new Error(error.message);

  try {
    const { syncZkWatchLineChecksFromOrder } = await import("@/lib/sales/zk-watch-order-sync");
    await Promise.all(
      ((rowsRaw ?? []) as unknown as IndividualOrder[]).map((row) =>
        syncZkWatchLineChecksFromOrder({
          ...row,
          sales_acknowledged_at: null,
        })
      )
    );
  } catch (e) {
    console.error("[rollbackZkWatchPendingAck syncZkWatchLineChecks]", e);
  }
}

export async function acknowledgeZdDeadlineWithClient(
  supabase: SupabaseClient,
  salesPersonId: string,
  orderIds: string[],
  options?: { revalidate?: boolean }
): Promise<AckMutationResult> {
  const uniqueIds = [...new Set(orderIds.map((id) => id.trim()).filter(Boolean))];
  if (!uniqueIds.length) return { count: 0, ackedIds: [] };

  const now = new Date().toISOString();
  const { data: rowsRaw, error: fetchError } = await supabase
    .from("individual_orders")
    .select(
      "id, sales_person_id, zd_fulfillment_deadline_changed_at, zd_fulfillment_deadline_change_seen_at"
    )
    .in("id", uniqueIds);

  if (fetchError) throw new Error(fetchError.message);
  const rows = rowsRaw ?? [];
  if (!rows.length) throw new Error("Nie znaleziono pozycji.");

  const pendingIds: string[] = [];
  for (const row of rows) {
    if (row.sales_person_id !== salesPersonId) {
      throw new Error("Brak uprawnień do tej pozycji.");
    }
    if (row.zd_fulfillment_deadline_change_seen_at) {
      continue;
    }
    if (!row.zd_fulfillment_deadline_changed_at) {
      continue;
    }
    pendingIds.push(row.id);
  }

  if (!pendingIds.length) return { count: 0, ackedIds: [] };

  const { data: updatedRows, error } = await supabase
    .from("individual_orders")
    .update({ zd_fulfillment_deadline_change_seen_at: now })
    .in("id", pendingIds)
    .eq("sales_person_id", salesPersonId)
    .is("zd_fulfillment_deadline_change_seen_at", null)
    .select("id");

  if (error) throw new Error(error.message);

  const ackedIds = (updatedRows ?? []).map((r) => r.id);

  if (options?.revalidate !== false) {
    revalidatePath("/moje");
  }

  return { count: ackedIds.length, ackedIds };
}

export async function acknowledgeOrdersWithClient(
  supabase: SupabaseClient,
  salesPersonId: string,
  orderIds: string[],
  options: AckOptions = {},
  ackOptions?: { revalidate?: boolean }
): Promise<AckMutationResult> {
  if (!orderIds.length) return { count: 0, ackedIds: [] };

  const caps = await getSalesCancelDbCaps(supabase);
  const now = new Date().toISOString();

  const { data: rowsRaw, error: fetchError } = await supabase
    .from("individual_orders")
    .select(salesCancelAckSelect(caps))
    .in("id", orderIds);

  if (fetchError) throw new Error(fetchError.message);
  const rows = (rowsRaw ?? []) as unknown as IndividualOrder[];
  if (!rows.length) throw new Error("Nie znaleziono pozycji.");

  const pendingRows: IndividualOrder[] = [];
  for (const row of rows) {
    if (row.sales_person_id !== salesPersonId) {
      throw new Error("Brak uprawnień do tej pozycji.");
    }
    if (row.sales_acknowledged_at) {
      continue;
    }
    if (options.requireSalesCancelled) {
      if (!caps.hasCancelledAt) {
        throw new Error(SALES_CANCEL_MIGRATION_HINT);
      }
      if (!isSalesCancelNoticePending(row as IndividualOrder)) {
        continue;
      }
    } else if (options.allowedStatuses?.length) {
      if (!options.allowedStatuses.includes(row.status as IndividualOrderStatus)) {
        continue;
      }
    }
    pendingRows.push(row as IndividualOrder);
  }

  const pendingIds = pendingRows.map((row) => row.id);
  if (!pendingIds.length) return { count: 0, ackedIds: [] };

  const { data: updatedRows, error } = await supabase
    .from("individual_orders")
    .update({ sales_acknowledged_at: now })
    .in("id", pendingIds)
    .eq("sales_person_id", salesPersonId)
    .is("sales_acknowledged_at", null)
    .select("id");

  if (error) throw new Error(error.message);

  const ackedIds = (updatedRows ?? []).map((r) => r.id);
  const ackedRows = pendingRows.filter((row) => ackedIds.includes(row.id));

  if (ackOptions?.revalidate !== false) {
    revalidateSalesOrderPaths();
  }

  try {
    const { syncZkWatchLineChecksFromOrder } = await import("@/lib/sales/zk-watch-order-sync");
    await Promise.all(
      ackedRows.map((row) =>
        syncZkWatchLineChecksFromOrder({
          ...row,
          sales_acknowledged_at: now,
        })
      )
    );
  } catch (e) {
    console.error("[acknowledgeOrders syncZkWatchLineChecks]", e);
  }

  return { count: ackedIds.length, ackedIds };
}

/** Kolejność: ZD → odbiór/informacja → rezygnacja → anulowanie. Przy błędzie — rollback. */
export async function executeZkWatchPendingAckPlan(
  _watch: SalesZkWatch,
  items: ZkWatchPendingAckItem[],
  supabase: SupabaseClient,
  salesPersonId: string
): Promise<number> {
  if (!items.length) return 0;

  const grouped = groupZkWatchPendingAckOrderIdsByKind(items);
  const rolledBack = { zdDeadlineIds: [] as string[], salesAckIds: [] as string[] };
  let total = 0;

  try {
    if (grouped.zd_deadline.length) {
      const result = await acknowledgeZdDeadlineWithClient(
        supabase,
        salesPersonId,
        grouped.zd_deadline,
        { revalidate: false }
      );
      rolledBack.zdDeadlineIds.push(...result.ackedIds);
      total += result.count;
    }

    const pickupIds = [...new Set([...grouped.pickup, ...grouped.availability])];
    if (pickupIds.length) {
      const result = await acknowledgeOrdersWithClient(
        supabase,
        salesPersonId,
        pickupIds,
        { allowedStatuses: ["Zrealizowane"] },
        { revalidate: false }
      );
      rolledBack.salesAckIds.push(...result.ackedIds);
      total += result.count;
    }

    if (grouped.cancel_notice.length) {
      const result = await acknowledgeOrdersWithClient(
        supabase,
        salesPersonId,
        grouped.cancel_notice,
        { requireSalesCancelled: true },
        { revalidate: false }
      );
      rolledBack.salesAckIds.push(...result.ackedIds);
      total += result.count;
    }

    if (grouped.cancelled.length) {
      const result = await acknowledgeOrdersWithClient(
        supabase,
        salesPersonId,
        grouped.cancelled,
        { allowedStatuses: ["Anulowane"] },
        { revalidate: false }
      );
      rolledBack.salesAckIds.push(...result.ackedIds);
      total += result.count;
    }
  } catch (error) {
    try {
      await rollbackZkWatchPendingAck(supabase, salesPersonId, rolledBack);
    } catch (rollbackError) {
      console.error("[executeZkWatchPendingAckPlan rollback]", rollbackError);
      throw new Error(
        "Nie udało się potwierdzić pozycji i cofnąć częściowych zmian — odśwież /moje i spróbuj ponownie."
      );
    }
    revalidateSalesOrderPaths();
    throw error instanceof Error
      ? error
      : new Error("Nie udało się potwierdzić wszystkich pozycji.");
  }

  revalidateSalesOrderPaths();

  return total;
}
