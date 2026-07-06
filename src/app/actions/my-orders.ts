"use server";

// @user-jwt-ok — autoryzacja require*() + RLS individual_orders (071) dla mutacji handlowca.

import { revalidatePath } from "next/cache";
import { getSessionUser } from "@/lib/auth";
import { resolveSalesPersonForUser } from "@/lib/auth/sales-person";
import { isSalesAccount } from "@/lib/auth-roles";
import { createClient } from "@/lib/supabase/server";
import {
  effectiveSalesCancelPhase,
  mergeSalesCancelUserAutoAck,
  planSalesCancelQuantity,
  resolveSalesCancelPhase,
  salesCancelUndoRestoreStatus,
} from "@/lib/orders/sales-cancel";
import { normalizeSalesClientAssignment } from "@/lib/orders/sales-client-label";
import {
  buildSalesCancelUndoUpdate,
  buildSalesCancelUpdate,
  getSalesCancelDbCaps,
  SALES_CANCEL_MIGRATION_HINT,
  SALES_CANCEL_QUANTITY_MIGRATION_HINT,
  salesCancelAckSelect,
  salesCancelOrderSelect,
  type SalesCancelUndoRestore,
} from "@/lib/orders/sales-cancel-db";
import type { IndividualOrder } from "@/types/database";
import { updateIndividualRequestGroup } from "@/lib/services/orders";
import type { IndividualRequestEditPayload } from "@/lib/orders/individual-request-edit";
import {
  groupTeethDetails,
  expandTeethGroups,
  type TeethGroupDraft,
} from "@/lib/teeth/teeth-catalog";
import {
  saveTeethDetailsForOrders,
  fetchTeethDetailsForOrders,
} from "@/lib/data/teeth-order-details";
import { normalizeTeethDetailsForSave } from "@/lib/teeth/teeth-validation";
import { parseOrderQuantity } from "@/lib/orders/individual";
import { deliveryProgressFor } from "@/lib/orders/sales-cancel";
import { UNDO_WINDOW_MS } from "@/lib/orders/daily-panel-undo";
import type { SalesZkWatch } from "@/types/database";
import { resolveZkWatchPendingAckItemsForWatch, fetchTeethOrdersForZkWatch } from "@/lib/sales/zk-watch-close-pending-fetch";
import {
  acknowledgeOrdersWithClient,
  acknowledgeZdDeadlineWithClient,
  executeZkWatchPendingAckPlan,
  type AckOptions,
} from "@/lib/sales/zk-watch-pending-ack-plan";
import { actionCloseZkWatch } from "@/app/actions/sales-notepad";

async function salesPersonIdForAction(): Promise<string> {
  const user = await getSessionUser();
  if (!user) throw new Error("Wymagane logowanie");
  if (!isSalesAccount(user.role)) {
    throw new Error("Brak uprawnień do tej operacji.");
  }
  const resolved = await resolveSalesPersonForUser(user);
  if (!resolved) {
    throw new Error("Konto nie jest powiązane z kartą handlowca.");
  }
  return resolved.id;
}

async function salesOrderSupabase() {
  return createClient();
}

async function acknowledgeOrders(
  orderIds: string[],
  options: AckOptions = {}
) {
  if (!orderIds.length) throw new Error("Brak pozycji do potwierdzenia.");
  const salesPersonId = await salesPersonIdForAction();
  const supabase = await salesOrderSupabase();
  const { count } = await acknowledgeOrdersWithClient(
    supabase,
    salesPersonId,
    orderIds,
    options
  );
  if (count === 0) {
    throw new Error("Ta pozycja nie wymaga już potwierdzenia.");
  }
  return { success: true, count };
}

async function loadZkWatchForPendingAck(
  supabase: Awaited<ReturnType<typeof salesOrderSupabase>>,
  watchId: string,
  salesPersonId: string
): Promise<SalesZkWatch> {
  const { data: watchRaw, error: watchError } = await supabase
    .from("sales_zk_watches")
    .select("*")
    .eq("id", watchId)
    .maybeSingle();

  if (watchError) throw new Error(watchError.message);
  if (!watchRaw) throw new Error("Nie znaleziono wpisu ZK.");
  if (watchRaw.sales_person_id !== salesPersonId) {
    throw new Error("Brak uprawnień do tego wpisu.");
  }
  if (watchRaw.closed_at) {
    throw new Error("Ten ZK został już zamknięty.");
  }

  return watchRaw as SalesZkWatch;
}

/** Przypisanie lub zmiana klienta końcowego (tylko handlowiec). */
export async function actionUpdateSalesClientName(
  orderId: string,
  clientName: string | null,
  clientKhId?: number | null
) {
  const salesPersonId = await salesPersonIdForAction();
  const supabase = await salesOrderSupabase();
  const { clientName: normalized, clientKhId: normalizedKh } = normalizeSalesClientAssignment({
    clientName,
    clientKhId,
  });

  const { data: row, error: fetchError } = await supabase
    .from("individual_orders")
    .select("id, sales_person_id")
    .eq("id", orderId)
    .maybeSingle();

  if (fetchError) throw new Error(fetchError.message);
  if (!row) throw new Error("Nie znaleziono pozycji.");
  if (row.sales_person_id !== salesPersonId) {
    throw new Error("Brak uprawnień do tej pozycji.");
  }

  const { error } = await supabase
    .from("individual_orders")
    .update({
      sales_client_name: normalized,
      sales_client_kh_id: normalizedKh,
    })
    .eq("id", orderId)
    .eq("sales_person_id", salesPersonId);

  if (error) {
    if (error.message?.includes("sales_client_name")) {
      throw new Error(
        "Brak kolumny sales_client_name — uruchom migrację 017_sales_client_name.sql"
      );
    }
    if (error.message?.includes("sales_client_kh_id")) {
      throw new Error(
        "Brak kolumny sales_client_kh_id — uruchom migrację 052_individual_orders_sales_client_kh_id.sql"
      );
    }
    throw new Error(error.message);
  }

  revalidatePath("/moje");
  return { success: true, clientName: normalized, clientKhId: normalizedKh };
}

/** Ukrycie anulowanej prośby / dostawy. */
export async function actionAcknowledgeCancelled(orderIds: string[]) {
  return acknowledgeOrders(orderIds, { allowedStatuses: ["Anulowane"] });
}

/** Ukrycie informacji o rezygnacji (towar w drodze / na stanie). */
export async function actionAcknowledgeSalesCancelNotice(orderIds: string[]) {
  return acknowledgeOrders(orderIds, { requireSalesCancelled: true });
}

/** Wycofanie prośby przez handlowca (klient się rozmyślił). */
export async function actionSalesCancelOrders(
  orderIds: string[],
  options?: { quantityById?: Record<string, number> }
) {
  if (!orderIds.length) throw new Error("Brak pozycji do anulowania.");
  const salesPersonId = await salesPersonIdForAction();
  const supabase = await salesOrderSupabase();
  const caps = await getSalesCancelDbCaps(supabase);
  const now = new Date().toISOString();
  const quantityById = options?.quantityById ?? {};

  const { data: rowsRaw, error: fetchError } = await supabase
    .from("individual_orders")
    .select(salesCancelOrderSelect(caps))
    .in("id", orderIds);

  if (fetchError) {
    if (fetchError.message?.includes("sales_cancelled_at")) {
      throw new Error(SALES_CANCEL_MIGRATION_HINT);
    }
    if (fetchError.message?.includes("sales_cancelled_quantity")) {
      throw new Error(SALES_CANCEL_QUANTITY_MIGRATION_HINT);
    }
    throw new Error(fetchError.message);
  }
  const rows = (rowsRaw ?? []) as unknown as IndividualOrder[];
  if (!rows.length) throw new Error("Nie znaleziono pozycji.");

  const toCancel: {
    id: string;
    phase: NonNullable<ReturnType<typeof resolveSalesCancelPhase>>;
    quantityPlan?: ReturnType<typeof planSalesCancelQuantity>;
  }[] = [];

  for (const row of rows) {
    if (row.sales_person_id !== salesPersonId) {
      throw new Error("Brak uprawnień do tej pozycji.");
    }
    if (row.sales_acknowledged_at) {
      throw new Error("Ta pozycja jest już zamknięta.");
    }

    const phase = resolveSalesCancelPhase(row as IndividualOrder);
    if (!phase) {
      if (caps.hasCancelledAt && row.sales_cancelled_at) {
        continue;
      }
      throw new Error("Tej prośby nie można już wycofać.");
    }
    if (!caps.hasCancelledAt && phase !== "before_order") {
      throw new Error(SALES_CANCEL_MIGRATION_HINT);
    }

    let quantityPlan: ReturnType<typeof planSalesCancelQuantity> | undefined;
    const requestedQty = quantityById[row.id];
    if (requestedQty != null || caps.hasCancelledQuantity) {
      if (!caps.hasCancelledQuantity && requestedQty != null) {
        throw new Error(SALES_CANCEL_QUANTITY_MIGRATION_HINT);
      }
      if (caps.hasCancelledQuantity) {
        quantityPlan = planSalesCancelQuantity(row as IndividualOrder, requestedQty);
      }
    }

    toCancel.push({ id: row.id, phase, quantityPlan });
  }

  if (!toCancel.length) {
    throw new Error("Wybrane pozycje są już wycofane lub zamknięte.");
  }

  for (const { id, phase, quantityPlan } of toCancel) {
    const row = rows.find((r) => r.id === id)!;
    const update = buildSalesCancelUpdate(caps, phase, now, quantityPlan);
    if (!update) {
      throw new Error(SALES_CANCEL_MIGRATION_HINT);
    }
    mergeSalesCancelUserAutoAck(update, row as IndividualOrder, caps, now);

    const q = supabase
      .from("individual_orders")
      .update(update)
      .eq("id", id)
      .eq("sales_person_id", salesPersonId)
      .is("sales_acknowledged_at", null);

    const { data: updated, error } = await q.select("id");

    if (error) {
      if (
        error.message?.includes("sales_cancelled_at") ||
        error.message?.includes("sales_cancel_phase") ||
        error.message?.includes("sales_cancelled_quantity")
      ) {
        throw new Error(
          error.message?.includes("sales_cancelled_quantity")
            ? SALES_CANCEL_QUANTITY_MIGRATION_HINT
            : SALES_CANCEL_MIGRATION_HINT
        );
      }
      throw new Error(error.message);
    }
    if (!updated?.length) {
      throw new Error("Nie udało się wycofać pozycji — odśwież listę i spróbuj ponownie.");
    }
  }

  revalidatePath("/moje");
  revalidatePath("/podsumowanie");
  revalidatePath("/kolejka");
  return {
    success: true,
    count: toCancel.length,
    phases: [...new Set(toCancel.map((t) => t.phase))],
  };
}

/** Wycofanie konkretnych grup zębów przez handlowca. */
export async function actionSalesCancelTeethGroups(
  orderId: string,
  cancelGroups: { color: string; mould: string | null; jaw: string | null; kind: string | null; count: number }[]
) {
  if (!orderId) throw new Error("Brak pozycji do anulowania.");
  if (!cancelGroups?.length) throw new Error("Wybierz co najmniej jedną grupę do wycofania.");

  const salesPersonId = await salesPersonIdForAction();
  const supabase = await salesOrderSupabase();
  const caps = await getSalesCancelDbCaps(supabase);
  const now = new Date().toISOString();

  const { data: rowRaw, error: fetchError } = await supabase
    .from("individual_orders")
    .select(salesCancelOrderSelect(caps))
    .eq("id", orderId)
    .maybeSingle();

  if (fetchError) throw new Error(fetchError.message);
  if (!rowRaw) throw new Error("Nie znaleziono pozycji.");
  const order = rowRaw as unknown as IndividualOrder;

  if (order.sales_person_id !== salesPersonId) {
    throw new Error("Brak uprawnień do tej pozycji.");
  }
  if (order.sales_acknowledged_at) {
    throw new Error("Ta pozycja jest już zamknięta.");
  }

  const phase = resolveSalesCancelPhase(order);
  if (!phase) {
    throw new Error("Tej prośby nie można już wycofać.");
  }

  const teethMap = await fetchTeethDetailsForOrders([orderId]);
  const existingDetails = teethMap.get(orderId) ?? [];
  if (!existingDetails.length) {
    throw new Error("Brak listy zębów dla tej pozycji.");
  }

  const existingGroups = groupTeethDetails(
    existingDetails.map((d) => ({
      position: d.position,
      color: d.color,
      mould: d.mould ?? null,
      jaw: d.jaw ?? null,
      kind: d.kind ?? null,
    }))
  );

  const groupKey = (g: { color: string; mould: string | null; jaw: string | null; kind: string | null }) =>
    `${g.color}|${g.mould ?? ""}|${g.jaw ?? ""}|${g.kind ?? ""}`;

  let totalCancelQty = 0;
  const remainingGroups: TeethGroupDraft[] = [];

  for (const eg of existingGroups) {
    const key = groupKey(eg);
    const cancelEntry = cancelGroups.find((cg) => groupKey(cg) === key);
    const cancelCount = cancelEntry?.count ?? 0;

    if (cancelCount < 0 || cancelCount > eg.count) {
      throw new Error(`Nieprawidłowa ilość do wycofania dla grupy ${eg.color}.`);
    }

    totalCancelQty += cancelCount;
    const remaining = eg.count - cancelCount;
    if (remaining > 0) {
      remainingGroups.push({
        id: `tg-${key}`,
        color: eg.color,
        mould: eg.mould,
        jaw: eg.jaw,
        kind: eg.kind,
        count: remaining,
      });
    }
  }

  if (totalCancelQty < 1) {
    throw new Error("Wybierz co najmniej 1 szt. do wycofania.");
  }

  const orderedQty = parseOrderQuantity(order.quantity);
  if (orderedQty == null) {
    throw new Error("Brak ilości liczbowej — możliwa tylko pełna rezygnacja.");
  }

  const existingCancelled = (() => {
    const explicit = parseOrderQuantity(order.sales_cancelled_quantity ?? "");
    if (explicit != null && order.sales_cancelled_at) return explicit;
    if (!order.sales_cancelled_at) return 0;
    if (order.status === "Anulowane") return orderedQty;
    const delivered = deliveryProgressFor(order).delivered;
    return Math.max(0, orderedQty - delivered);
  })();

  const newTotalCancelled = existingCancelled + totalCancelQty;
  const newActiveQty = orderedQty - newTotalCancelled;
  const fullyWithdrawn = newActiveQty <= 0;

  const storedCancelledQuantity = fullyWithdrawn ? null : String(newTotalCancelled);

  let statusAfter: IndividualOrder["status"] | undefined;
  if (fullyWithdrawn && phase === "before_order") {
    statusAfter = "Anulowane";
  } else if (!fullyWithdrawn) {
    const delivered = deliveryProgressFor(order).delivered;
    if (delivered > 0 && delivered >= newActiveQty) {
      statusAfter = "Zrealizowane";
    }
  }

  const keepLineActive = !fullyWithdrawn && statusAfter !== "Anulowane";

  const update = buildSalesCancelUpdate(caps, phase, now, {
    storedCancelledQuantity,
    statusAfter,
    keepLineActiveForSales: keepLineActive,
  });
  if (!update) {
    throw new Error(SALES_CANCEL_MIGRATION_HINT);
  }
  mergeSalesCancelUserAutoAck(update, order, caps, now);

  if (!keepLineActive) {
    update.sales_acknowledged_at = now;
  }

  const { error: updateError } = await supabase
    .from("individual_orders")
    .update(update)
    .eq("id", orderId)
    .eq("sales_person_id", salesPersonId)
    .is("sales_acknowledged_at", null);

  if (updateError) throw new Error(updateError.message);

  if (!fullyWithdrawn && remainingGroups.length > 0) {
    const newDetails = expandTeethGroups(remainingGroups);
    await saveTeethDetailsForOrders(supabase, [
      {
        orderId,
        isTeeth: true,
        teethDetails: normalizeTeethDetailsForSave(newDetails, null),
      },
    ]);
  }

  revalidatePath("/moje");
  revalidatePath("/podsumowanie");
  revalidatePath("/kolejka");
  revalidatePath("/zeby");
  return {
    success: true as const,
    cancelledQty: totalCancelQty,
    fullyWithdrawn,
  };
}

/** Potwierdzenie odbioru z magazynu (pojedyncza pozycja lub linia w grupie). */
export async function actionAcknowledgePickup(orderIds: string[]) {
  return acknowledgeOrders(orderIds, { allowedStatuses: ["Zrealizowane"] });
}

export async function actionUnacknowledgePickup(orderIds: string[]) {
  if (!orderIds.length) throw new Error("Brak pozycji do cofnięcia.");
  const salesPersonId = await salesPersonIdForAction();
  const supabase = await salesOrderSupabase();
  const now = Date.now();

  const { data: rows, error: fetchError } = await supabase
    .from("individual_orders")
    .select("id, status, sales_person_id, sales_acknowledged_at")
    .in("id", orderIds);

  if (fetchError) throw new Error(fetchError.message);
  if (!rows?.length) throw new Error("Nie znaleziono pozycji.");

  for (const row of rows) {
    if (row.sales_person_id !== salesPersonId) {
      throw new Error("Brak uprawnień do tej pozycji.");
    }
    if (!row.sales_acknowledged_at) {
      throw new Error("Ta pozycja nie była jeszcze potwierdzona.");
    }
    if (row.status !== "Zrealizowane") {
      throw new Error("Cofnięcie dotyczy tylko potwierdzenia odbioru.");
    }
    const ackAt = new Date(row.sales_acknowledged_at).getTime();
    if (now - ackAt > UNDO_WINDOW_MS) {
      throw new Error("Minął czas na cofnięcie — odśwież listę.");
    }
  }

  const { error } = await supabase
    .from("individual_orders")
    .update({ sales_acknowledged_at: null })
    .in("id", orderIds)
    .eq("sales_person_id", salesPersonId)
    .eq("status", "Zrealizowane")
    .not("sales_acknowledged_at", "is", null);

  if (error) throw new Error(error.message);

  revalidatePath("/moje");
  revalidatePath("/podsumowanie");
  revalidatePath("/kolejka");
  revalidatePath("/notatnik");
  revalidatePath("/zk");

  try {
    const { syncZkWatchLineChecksFromOrder } = await import("@/lib/sales/zk-watch-order-sync");
    await Promise.all(
      (rows as IndividualOrder[]).map((row) =>
        syncZkWatchLineChecksFromOrder({
          ...row,
          sales_acknowledged_at: null,
        })
      )
    );
  } catch (e) {
    console.error("[actionUnacknowledgePickup syncZkWatch]", e);
  }

  return { success: true, count: orderIds.length };
}

/** Cofnięcie wycofania prośby (okno undo po actionSalesCancelOrders). */
export async function actionUnacknowledgeSalesCancel(
  orderIds: string[],
  options?: { restoreById?: Record<string, SalesCancelUndoRestore> }
) {
  if (!orderIds.length) throw new Error("Brak pozycji do cofnięcia.");
  const salesPersonId = await salesPersonIdForAction();
  const supabase = await salesOrderSupabase();
  const caps = await getSalesCancelDbCaps(supabase);
  const now = Date.now();

  const { data: rowsRaw, error: fetchError } = await supabase
    .from("individual_orders")
    .select(salesCancelAckSelect(caps))
    .in("id", orderIds);

  if (fetchError) throw new Error(fetchError.message);
  const rows = (rowsRaw ?? []) as unknown as IndividualOrder[];
  if (!rows.length) throw new Error("Nie znaleziono pozycji.");

  for (const row of rows) {
    if (row.sales_person_id !== salesPersonId) {
      throw new Error("Brak uprawnień do tej pozycji.");
    }
    if (!row.sales_cancelled_at && !row.sales_acknowledged_at) {
      throw new Error("Ta pozycja nie była jeszcze wycofana.");
    }
    const cancelledAt = row.sales_cancelled_at;
    const legacyCancel = !caps.hasCancelledAt && row.status === "Anulowane";
    if (!cancelledAt && !legacyCancel && !row.sales_acknowledged_at) {
      throw new Error("Cofnięcie dotyczy tylko właśnie wycofanych pozycji.");
    }
    const undoAnchor = cancelledAt ?? row.sales_acknowledged_at;
    if (!undoAnchor) {
      throw new Error("Brak znacznika czasu do cofnięcia.");
    }
    const anchorMs = new Date(undoAnchor).getTime();
    if (now - anchorMs > UNDO_WINDOW_MS) {
      throw new Error("Minął czas na cofnięcie — odśwież listę.");
    }
  }

  let restoredCount = 0;

  for (const row of rows) {
    const phase =
      effectiveSalesCancelPhase(row) ??
      (row.sales_cancel_phase as ReturnType<typeof resolveSalesCancelPhase>) ??
      (row.status === "Anulowane" ? "before_order" : null);
    if (!phase) {
      throw new Error("Nie można cofnąć tej pozycji.");
    }
    const restoreStatus = salesCancelUndoRestoreStatus(row, phase);
    const restore = options?.restoreById?.[row.id] ?? null;
    const update = buildSalesCancelUndoUpdate(caps, restoreStatus, restore);

    let q = supabase
      .from("individual_orders")
      .update(update)
      .eq("id", row.id)
      .eq("sales_person_id", salesPersonId);

    if (caps.hasCancelledAt) {
      q = q.not("sales_cancelled_at", "is", null);
    } else {
      q = q.eq("status", "Anulowane");
    }

    const { data: updated, error } = await q.select("id");
    if (error) throw new Error(error.message);
    restoredCount += updated?.length ?? 0;
  }

  if (restoredCount !== rows.length) {
    throw new Error("Nie udało się cofnąć — odśwież listę i spróbuj ponownie.");
  }

  revalidatePath("/moje");
  revalidatePath("/podsumowanie");
  revalidatePath("/kolejka");
  revalidatePath("/notatnik");
  revalidatePath("/zk");
  return { success: true, count: restoredCount };
}

/** Cofnięcie potwierdzenia anulowania / informacji o rezygnacji (okno undo). */
export async function actionUnacknowledgeDismiss(orderIds: string[]) {
  if (!orderIds.length) throw new Error("Brak pozycji do cofnięcia.");
  const salesPersonId = await salesPersonIdForAction();
  const supabase = await salesOrderSupabase();
  const caps = await getSalesCancelDbCaps(supabase);
  const now = Date.now();

  const { data: rowsRaw, error: fetchError } = await supabase
    .from("individual_orders")
    .select(salesCancelAckSelect(caps))
    .in("id", orderIds);

  if (fetchError) throw new Error(fetchError.message);
  const rows = (rowsRaw ?? []) as unknown as IndividualOrder[];
  if (!rows.length) throw new Error("Nie znaleziono pozycji.");

  for (const row of rows) {
    if (row.sales_person_id !== salesPersonId) {
      throw new Error("Brak uprawnień do tej pozycji.");
    }
    if (!row.sales_acknowledged_at) {
      throw new Error("Ta pozycja nie była jeszcze potwierdzona.");
    }
    const isCancelled = row.status === "Anulowane";
    const isCancelNotice = caps.hasCancelledAt && Boolean(row.sales_cancelled_at);
    if (!isCancelled && !isCancelNotice) {
      throw new Error("Cofnięcie dotyczy tylko potwierdzeń anulowania lub rezygnacji.");
    }
    const ackAt = new Date(row.sales_acknowledged_at).getTime();
    if (now - ackAt > UNDO_WINDOW_MS) {
      throw new Error("Minął czas na cofnięcie — odśwież listę.");
    }
  }

  const cancelledIds = rows
    .filter((row) => row.status === "Anulowane")
    .map((row) => row.id);
  const cancelNoticeIds = rows
    .filter((row) => caps.hasCancelledAt && row.sales_cancelled_at)
    .map((row) => row.id);

  if (cancelledIds.length) {
    const { error } = await supabase
      .from("individual_orders")
      .update({ sales_acknowledged_at: null })
      .in("id", cancelledIds)
      .eq("sales_person_id", salesPersonId)
      .eq("status", "Anulowane")
      .not("sales_acknowledged_at", "is", null);

    if (error) throw new Error(error.message);
  }

  if (cancelNoticeIds.length) {
    if (!caps.hasCancelledAt) {
      throw new Error(SALES_CANCEL_MIGRATION_HINT);
    }
    const { error } = await supabase
      .from("individual_orders")
      .update({ sales_acknowledged_at: null })
      .in("id", cancelNoticeIds)
      .eq("sales_person_id", salesPersonId)
      .not("sales_cancelled_at", "is", null)
      .not("sales_acknowledged_at", "is", null);

    if (error) throw new Error(error.message);
  }

  revalidatePath("/moje");
  revalidatePath("/podsumowanie");
  revalidatePath("/kolejka");
  revalidatePath("/notatnik");
  revalidatePath("/zk");
  return { success: true, count: orderIds.length };
}

export async function actionUpdateMyIndividualRequest(
  orderIds: string[],
  payload: IndividualRequestEditPayload
) {
  const salesPersonId = await salesPersonIdForAction();
  const supabase = await salesOrderSupabase();
  const result = await updateIndividualRequestGroup(orderIds, payload, {
    salesPersonIdConstraint: salesPersonId,
    supabase,
  });
  revalidatePath("/moje");
  revalidatePath("/podsumowanie");
  revalidatePath("/prosba");
  revalidatePath("/zeby");
  return { success: true as const, ...result };
}

export async function actionAcknowledgeZdFulfillmentDeadlineChange(orderIds: string[]) {
  const uniqueIds = [...new Set(orderIds.map((id) => id.trim()).filter(Boolean))];
  if (!uniqueIds.length) throw new Error("Brak pozycji do potwierdzenia.");

  const salesPersonId = await salesPersonIdForAction();
  const supabase = await salesOrderSupabase();
  const { count } = await acknowledgeZdDeadlineWithClient(supabase, salesPersonId, uniqueIds);
  return { success: true as const, count };
}

/** Potwierdza wszystkie oczekujące pozycje powiązane z danym ZK (jak ręcznie w /moje). */
export async function actionAcknowledgeZkWatchPendingOrders(watchId: string) {
  const salesPersonId = await salesPersonIdForAction();
  const supabase = await salesOrderSupabase();
  const watch = await loadZkWatchForPendingAck(supabase, watchId, salesPersonId);
  const items = await resolveZkWatchPendingAckItemsForWatch(watch, supabase);
  const count = await executeZkWatchPendingAckPlan(watch, items, supabase, salesPersonId);
  return { success: true as const, count };
}

/** Świeża lista niepotwierdzonych pozycji przed zamknięciem ZK (źródło prawdy: serwer). */
export async function actionFetchZkWatchClosePendingPreview(watchId: string) {
  const salesPersonId = await salesPersonIdForAction();
  const supabase = await salesOrderSupabase();
  const watch = await loadZkWatchForPendingAck(supabase, watchId, salesPersonId);
  const items = await resolveZkWatchPendingAckItemsForWatch(watch, supabase);
  return { success: true as const, items };
}

/** Potwierdza wszystkie wiszące pozycje i zamyka sprawę ZK w jednej operacji serwerowej. */
export async function actionAcknowledgeAndCloseZkWatch(watchId: string) {
  const salesPersonId = await salesPersonIdForAction();
  const supabase = await salesOrderSupabase();
  const watch = await loadZkWatchForPendingAck(supabase, watchId, salesPersonId);
  const items = await resolveZkWatchPendingAckItemsForWatch(watch, supabase);
  const ackCount = await executeZkWatchPendingAckPlan(watch, items, supabase, salesPersonId);

  const freshItems = await resolveZkWatchPendingAckItemsForWatch(watch, supabase);
  if (freshItems.length > 0) {
    throw new Error(
      "Nie wszystkie pozycje udało się potwierdzić — odśwież listę i spróbuj ponownie."
    );
  }

  const { closedAt } = await actionCloseZkWatch(watchId);
  return { success: true as const, ackCount, closedAt };
}

/** Podgląd zamówionych zębów powiązanych z danym ZK (read-only). */
export async function actionFetchZkWatchTeethPreview(watchId: string) {
  const salesPersonId = await salesPersonIdForAction();
  const supabase = await salesOrderSupabase();
  const watch = await loadZkWatchForPendingAck(supabase, watchId, salesPersonId);

  const teethOrders = await fetchTeethOrdersForZkWatch(watch, supabase);
  if (teethOrders.length === 0) {
    return { success: true as const, rows: [] as import("@/lib/sales/zk-watch-teeth-preview").ZkTeethPreviewRow[] };
  }

  const teethDetailsMap = await fetchTeethDetailsForOrders(teethOrders.map((o) => o.id));
  const { buildZkTeethPreviewRows } = await import("@/lib/sales/zk-watch-teeth-preview");
  const rows = buildZkTeethPreviewRows(teethOrders, teethDetailsMap);
  return { success: true as const, rows };
}
