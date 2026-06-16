import { createAdminClient } from "@/lib/supabase/admin";
import type {
  DailyPanelUndoToken,
  IndividualOrderSnapshot,
  ScheduleSnapshot,
} from "@/lib/orders/daily-panel-undo";
import { recalcSupplierSchedule } from "@/lib/services/orders";
import { buildScheduleFeedback } from "@/lib/orders/daily-panel-action-feedback";
import { glowneScheduleSupplierIds, glowneSchedulableSupplierIds } from "@/lib/orders/glowne-supplier-placement";
import {
  isProcurementCancelNoteColumnMissing,
} from "@/lib/orders/procurement-cancel-note";

export { buildScheduleFeedback } from "@/lib/orders/daily-panel-action-feedback";

export async function captureScheduleSnapshot(
  supplierId: string
): Promise<ScheduleSnapshot> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("supplier_schedules")
    .select("order_date, shift_date")
    .eq("supplier_id", supplierId)
    .maybeSingle();

  return {
    supplierId,
    orderDate: data?.order_date ?? null,
    shiftDate: data?.shift_date ?? null,
  };
}

export async function captureScheduleSnapshots(
  supplierIds: string[]
): Promise<ScheduleSnapshot[]> {
  const unique = [...new Set(supplierIds)];
  return Promise.all(unique.map((id) => captureScheduleSnapshot(id)));
}

export async function captureIndividualOrdersSnapshot(
  orderIds: string[]
): Promise<IndividualOrderSnapshot[]> {
  if (!orderIds.length) return [];
  const supabase = createAdminClient();
  const fullSelect =
    "id, status, order_type, ordered_at, placement_group_id, procurement_seen_at, informacja_queue_via_daily_panel, informacja_stock_out_reorder, procurement_cancel_note";
  const legacySelect =
    "id, status, order_type, ordered_at, placement_group_id, procurement_seen_at, informacja_queue_via_daily_panel, informacja_stock_out_reorder";

  let data: Record<string, unknown>[] | null = null;
  let usedLegacySelect = false;

  const fullRes = await supabase.from("individual_orders").select(fullSelect).in("id", orderIds);
  if (fullRes.error) {
    if (isProcurementCancelNoteColumnMissing(fullRes.error.message)) {
      const legacyRes = await supabase
        .from("individual_orders")
        .select(legacySelect)
        .in("id", orderIds);
      if (legacyRes.error) throw new Error(legacyRes.error.message);
      data = legacyRes.data as Record<string, unknown>[] | null;
      usedLegacySelect = true;
    } else {
      throw new Error(fullRes.error.message);
    }
  } else {
    data = fullRes.data as Record<string, unknown>[] | null;
  }

  return (data ?? []).map((row) => ({
    orderId: row.id as string,
    status: row.status as string,
    orderType: (row.order_type as string | null) ?? null,
    orderedAt: (row.ordered_at as string | null) ?? null,
    placementGroupId: (row.placement_group_id as string | null) ?? null,
    procurementSeenAt: (row.procurement_seen_at as string | null) ?? null,
    informacjaQueueViaDailyPanel:
      (row.informacja_queue_via_daily_panel as boolean | null) ?? null,
    informacjaStockOutReorder:
      (row.informacja_stock_out_reorder as boolean | null) ?? null,
    procurementCancelNote: usedLegacySelect
      ? null
      : ((row.procurement_cancel_note as string | null) ?? null),
  }));
}

export async function restoreScheduleSnapshot(
  snapshot: ScheduleSnapshot
): Promise<void> {
  const supabase = createAdminClient();
  await supabase.from("supplier_schedules").upsert(
    {
      supplier_id: snapshot.supplierId,
      order_date: snapshot.orderDate,
      shift_date: snapshot.shiftDate,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "supplier_id" }
  );
  await recalcSupplierSchedule(snapshot.supplierId);
}

async function restoreIndividualOrderSnapshot(
  snapshot: IndividualOrderSnapshot
): Promise<void> {
  const supabase = createAdminClient();
  const baseUpdate = {
    status: snapshot.status,
    order_type: snapshot.orderType,
    ordered_at: snapshot.orderedAt,
    placement_group_id: snapshot.placementGroupId,
    procurement_seen_at: snapshot.procurementSeenAt,
    ...(snapshot.informacjaQueueViaDailyPanel !== null
      ? { informacja_queue_via_daily_panel: snapshot.informacjaQueueViaDailyPanel }
      : {}),
    ...(snapshot.informacjaStockOutReorder !== null
      ? { informacja_stock_out_reorder: snapshot.informacjaStockOutReorder }
      : {}),
  };

  let { error } = await supabase
    .from("individual_orders")
    .update({
      ...baseUpdate,
      procurement_cancel_note: snapshot.procurementCancelNote,
    })
    .eq("id", snapshot.orderId);

  if (error && isProcurementCancelNoteColumnMissing(error.message)) {
    ({ error } = await supabase
      .from("individual_orders")
      .update(baseUpdate)
      .eq("id", snapshot.orderId));
  }

  if (error) throw new Error(error.message);
}

export async function revertDailyPanelChange(
  token: DailyPanelUndoToken
): Promise<void> {
  if (token.kind === "schedules") {
    for (const s of token.snapshots) {
      await restoreScheduleSnapshot(s);
    }
    return;
  }

  if (token.kind === "individual") {
    for (const o of token.snapshots) {
      await restoreIndividualOrderSnapshot(o);
    }
    return;
  }

  for (const o of token.individuals) {
    await restoreIndividualOrderSnapshot(o);
  }
  for (const s of token.schedules) {
    await restoreScheduleSnapshot(s);
  }
}

/** Dostawcy, u których Główne wywoła markStandardOrdered — snapshot przed akcją. */
export async function supplierIdsForGlownePlacement(
  orderIds: string[]
): Promise<string[]> {
  if (!orderIds.length) return [];
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("individual_orders")
    .select(
      "id, supplier_id, status, request_kind, informacja_queue_via_daily_panel"
    )
    .in("id", orderIds);

  const eligible = (data ?? []).filter((row) => row.status === "Nowe");
  const candidates = glowneScheduleSupplierIds(eligible, "GLOWNE");
  if (!candidates.size) return [];

  const { data: suppliers, error } = await supabase
    .from("suppliers")
    .select("id, order_on_demand, stock_raw, interval_raw, extra_info")
    .in("id", [...candidates]);
  if (error) throw new Error(error.message);

  return [...glowneSchedulableSupplierIds(candidates, suppliers ?? [])];
}

export async function supplierIdsFromIndividualOrders(
  orderIds: string[]
): Promise<string[]> {
  if (!orderIds.length) return [];
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("individual_orders")
    .select("supplier_id")
    .in("id", orderIds);
  const ids = new Set<string>();
  for (const row of data ?? []) {
    if (row.supplier_id) ids.add(row.supplier_id);
  }
  return [...ids];
}

/** Stan harmonogramu po akcji — do podglądu w toastcie cofania. */
export async function buildProcessIndividualFeedback(
  orderIds: string[],
  action: "GLOWNE" | "POBOCZNE",
  glowneSupplierIdsBeforeAction: string[] = []
): Promise<string[]> {
  const supplierIds = await supplierIdsFromIndividualOrders(orderIds);
  if (!supplierIds.length) return [];

  const adjustedIds = new Set(
    action === "GLOWNE" ? glowneSupplierIdsBeforeAction : []
  );

  return buildScheduleFeedback(supplierIds, action, adjustedIds);
}

/** Po „Zamówione” — kiedy wypada kolejne zamówienie planowe. */
export async function buildMarkOrderedFeedback(
  supplierIds: string[]
): Promise<string[]> {
  return buildScheduleFeedback(supplierIds, "ZAMOWIONE");
}
