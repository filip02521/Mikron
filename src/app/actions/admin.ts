"use server";

// @service-role-ok — autoryzacja require*(); service role z pełnym scope po warstwie aplikacji.

import { revalidatePath } from "next/cache";
import {
  requireAdmin,
  requireAdminForMutation,
  requireAdminOrSalesTeamManagement,
  requireOperations,
  requireSupplierManagement,
  getSessionUser,
} from "@/lib/auth";
import { assertCanSubmitIndividualOrders } from "@/lib/auth/assert-order-submit-access";
import {
  isAdmin,
  isSales,
  isSalesManager,
  canAccessOperations,
  canAccessTeethPanel,
} from "@/lib/auth-roles";
import { assertAdminPanelAllowsOperationsMutations } from "@/lib/auth/guard-admin-panel-preview";
import {
  assertManagerRequiresGroupInScope,
  canAccessSalesPerson,
} from "@/lib/data/sales-group-access";
import { fetchDeliveryStatsDiagnostics } from "@/lib/data/delivery-stats-diagnostics";
import { tryAcquireLock, releaseLock } from "@/lib/services/locks";
import {
  deactivateExpiredVacations,
  recalcSingleSupplierSchedule,
  syncSuppliersFromSettings,
} from "@/lib/services/sync";
import {
  markStandardOrdered,
  shiftSupplierOrder,
  batchAddIndividualOrders,
  markInformacjaArrived,
  processIndividualFromSummary,
  cancelIndividualOrder,
  updateDeliveredQuantity,
  batchUpdateDeliveredQuantities,
  processMarkedDeliveries,
  recalculateAllStats,
  completeVerificationOrder,
  updateIndividualRequestGroup,
  notifyProcurementCancelForOrders,
} from "@/lib/services/orders";
import {
  type AddIndividualOrdersEntry,
  type AddIndividualOrdersInput,
  type IndividualRequestEditPayload,
  normalizeAddIndividualOrdersInput,
} from "@/lib/orders/individual-request-edit";
import { assertProsbaSubmitStockAllowed } from "@/lib/orders/prosba-stock-server";
import type { ProcurementCancelDispositionInput } from "@/lib/orders/procurement-disposition";
import {
  canEditProcurementCancelNote,
  normalizeProcurementCancelNote,
  throwIfProcurementCancelNoteColumnMissing,
  buildProcurementCancelUpdate,
} from "@/lib/orders/procurement-cancel-note";
import type { InformacjaFlowPath } from "@/lib/orders/informacja-stock-out-reorder";
import { createAdminClient } from "@/lib/supabase/admin";
import { syncLinkedSalesPersonLoginEmail } from "@/lib/users/sync-sales-person-email";
import { intervalWeeksForStorage, parseInterval } from "@/lib/orders/dates";
import { resolveOrderOnDemandForSave } from "@/lib/orders/supplier-on-demand";
import { WAREHOUSE_SHELF_DEFAULT } from "@/lib/orders/warehouse-inventory";
import { validateSupplierContactFields } from "@/lib/orders/validate-supplier-contact";
import {
  parseWarehouseShipmentForm,
} from "@/lib/warehouse/delivery-carriers";
import { assertWarehouseCarrierSlug } from "@/app/actions/warehouse-carriers";
import type { IndividualRequestKind, SupplierLocation, StatsMode } from "@/types/database";
import {
  clampOptionalText,
  clampText,
  isValidEmail,
  MAX_DISPOSITION_NOTE_LEN,
  MAX_INTERVAL_RAW_LEN,
  MAX_SUPPLIER_EXTRA_LEN,
  MAX_SUPPLIER_MAILS_LEN,
  MAX_SUPPLIER_NAME_LEN,
  MAX_SUPPLIER_NOTES_LEN,
} from "@/lib/security/text-limits";
import { dateToIso, parseDateOnly, snapToBusinessDay } from "@/lib/orders/dates";
import {
  validateVacationFormInput,
  validateVacationOverlap,
} from "@/lib/orders/vacation-form-validation";
import {
  computeVacationSchedulePreview,
  supplierScheduleForPreview,
} from "@/lib/orders/vacation-preview";
import { todayDateKeyInWarsaw } from "@/lib/time/warsaw";
import {
  buildDailyPanelUndoPayload,
  isUndoPayloadExpired,
  undoWindowShortLabel,
} from "@/lib/orders/daily-panel-undo";
import type { DailyPanelActionResult } from "@/lib/orders/daily-panel-undo";
import type { DailyPanelUndoPayload } from "@/lib/orders/daily-panel-undo";
import {
  buildDeliveryUndoPayload,
  captureDeliverySnapshot,
  captureDeliverySnapshots,
  isDeliveryUndoExpired,
  revertDeliverySnapshots,
  type DeliveryUndoPayload,
} from "@/lib/orders/receive-queue-undo";
import {
  captureIndividualOrdersSnapshot,
  captureScheduleSnapshot,
  captureScheduleSnapshots,
  revertDailyPanelChange,
  supplierIdsForGlownePlacement,
  buildProcessIndividualFeedback,
  buildMarkOrderedFeedback,
  buildScheduleFeedback,
} from "@/lib/services/daily-panel-undo";

function revalidateAll() {
  revalidatePath("/", "layout");
  revalidatePath("/");
  revalidatePath("/podsumowanie");
  revalidatePath("/kolejka");
  revalidatePath("/historia");
  revalidatePath("/moje");
  revalidatePath("/plan");
  revalidatePath("/prosba");
  revalidatePath("/weryfikacja");
  revalidatePath("/zeby");
  revalidatePath("/lokalizacje/[location]", "page");
  revalidatePath("/admin");
  revalidatePath("/admin/handlowcy");
  revalidatePath("/admin/uzytkownicy");
  revalidatePath("/zespol", "page");
  revalidatePath("/zespol/handlowcy", "page");
  revalidatePath("/zespol/grupy", "page");
}

export async function actionDeleteIndividualHistory(orderId: string) {
  await requireAdminForMutation();
  const supabase = createAdminClient();
  await supabase.from("individual_orders").delete().eq("id", orderId);
  revalidateAll();
  return { success: true };
}

export async function actionDeleteNormalHistory(historyId: string) {
  await requireAdminForMutation();
  const supabase = createAdminClient();
  await supabase.from("normal_order_history").delete().eq("id", historyId);
  revalidateAll();
  return { success: true };
}

export async function actionSyncData() {
  await requireSupplierManagement("mutate");
  const ok = await tryAcquireLock("SCRIPT_BUSY", 60);
  if (!ok) return { error: "Trwa inna operacja" };
  try {
    const result = await syncSuppliersFromSettings();
    revalidateAll();
    if (result.errors.length) {
      return {
        success: false,
        ...result,
        error: `Zsynchronizowano ${result.processed}, błędy: ${result.errors.slice(0, 3).join("; ")}${result.errors.length > 3 ? "…" : ""}`,
      };
    }
    return { success: true, ...result };
  } catch (e) {
    return {
      error: e instanceof Error ? e.message : "Błąd synchronizacji",
    };
  } finally {
    await releaseLock("SCRIPT_BUSY");
  }
}

export async function actionMarkOrdered(
  supplierId: string
): Promise<DailyPanelActionResult> {
  const user = await requireOperations("mutate");
  const scheduleBefore = await captureScheduleSnapshot(supplierId);
  await markStandardOrdered(supplierId, user.email);
  const feedbackLines = await buildMarkOrderedFeedback([supplierId]);
  revalidateAll();
  return {
    success: true,
    feedbackLines,
    undo: buildDailyPanelUndoPayload({
      kind: "schedules",
      snapshots: [scheduleBefore],
    }),
  };
}

export async function actionShiftOrder(
  supplierId: string,
  weeks: number | null,
  manualDateIso: string | null
): Promise<DailyPanelActionResult> {
  const user = await requireOperations("mutate");
  const scheduleBefore = await captureScheduleSnapshot(supplierId);
  const manual = manualDateIso
    ? snapToBusinessDay(parseDateOnly(manualDateIso)!)
    : null;
  await shiftSupplierOrder(supplierId, weeks, manual, user.email);
  const feedbackLines = await buildScheduleFeedback([supplierId], "PRZESUNIETE");
  revalidateAll();
  return {
    success: true,
    feedbackLines,
    undo: buildDailyPanelUndoPayload({
      kind: "schedules",
      snapshots: [scheduleBefore],
    }),
  };
}

/** Zatwierdzenie planu tygodnia z trybu drag-and-drop (wszystkie przesunięcia naraz). */
export async function actionBatchShiftOrder(
  changes: Array<{ supplierId: string; manualDateIso: string }>
): Promise<DailyPanelActionResult> {
  const user = await requireOperations("mutate");
  const unique = new Map<string, string>();
  for (const c of changes) {
    if (!c.supplierId || !c.manualDateIso) continue;
    unique.set(c.supplierId, c.manualDateIso);
  }
  const list = [...unique.entries()];
  if (!list.length) {
    return { success: true };
  }

  const snapshots = await captureScheduleSnapshots(list.map(([id]) => id));

  for (const [supplierId, manualDateIso] of list) {
    const manual = snapToBusinessDay(parseDateOnly(manualDateIso)!);
    await shiftSupplierOrder(supplierId, null, manual, user.email);
  }

  const feedbackLines = await buildScheduleFeedback(
    list.map(([id]) => id),
    "PRZESUNIETE"
  );
  revalidateAll();
  return {
    success: true,
    feedbackLines,
    undo: buildDailyPanelUndoPayload({ kind: "schedules", snapshots }),
  };
}

export async function actionProcessIndividual(
  orderIds: string[],
  action: "GLOWNE" | "POBOCZNE" | "ANULOWANO",
  procurementCancelNote?: string | null
): Promise<DailyPanelActionResult> {
  const user = await requireOperations("mutate");
  const individualsBefore = await captureIndividualOrdersSnapshot(orderIds);
  const glowneSupplierIds =
    action === "GLOWNE" ? await supplierIdsForGlownePlacement(orderIds) : [];
  const scheduleBefore =
    action === "GLOWNE"
      ? await captureScheduleSnapshots(glowneSupplierIds)
      : [];

  await processIndividualFromSummary(
    orderIds,
    action,
    user.email,
    procurementCancelNote,
    user.id
  );
  revalidateAll();

  const token =
    scheduleBefore.length > 0
      ? {
          kind: "combined" as const,
          schedules: scheduleBefore,
          individuals: individualsBefore,
        }
      : { kind: "individual" as const, snapshots: individualsBefore };

  const feedbackLines =
    action === "ANULOWANO"
      ? undefined
      : await buildProcessIndividualFeedback(orderIds, action, glowneSupplierIds);

  return {
    success: true,
    undo: buildDailyPanelUndoPayload(token),
    feedbackLines,
  };
}

export async function actionMarkInformacjaArrived(
  orderIds: string[]
): Promise<
  | {
      success: true;
      updated: number;
      skipped: number;
      requested: number;
      emailSent: number;
      emailError?: string;
    }
  | { error: string }
> {
  const { requireWarehouse } = await import("@/lib/auth");
  await requireWarehouse("mutate");
  if (!orderIds.length) return { error: "Brak pozycji do oznaczenia." };
  try {
    const result = await markInformacjaArrived(orderIds);
    if (result.updated === 0) {
      return { error: "Nie znaleziono oczekujących prośb informacyjnych." };
    }
    revalidateAll();
    return { success: true, ...result };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Nie udało się powiadomić." };
  }
}

export async function actionBulkOrdered(
  supplierIds: string[]
): Promise<DailyPanelActionResult & { count: number }> {
  const user = await requireOperations("mutate");
  const schedulesBefore = await captureScheduleSnapshots(supplierIds);
  for (const id of supplierIds) {
    await markStandardOrdered(id, user.email);
  }
  const feedbackLines = await buildMarkOrderedFeedback(supplierIds);
  revalidateAll();
  return {
    success: true,
    count: supplierIds.length,
    feedbackLines,
    undo: buildDailyPanelUndoPayload({
      kind: "schedules",
      snapshots: schedulesBefore,
    }),
  };
}

export async function actionUndoDailyPanelChange(payload: DailyPanelUndoPayload) {
  await requireOperations("mutate");
  if (isUndoPayloadExpired(payload)) {
    throw new Error(`Minął czas na cofnięcie (${undoWindowShortLabel()}). Odśwież panel.`);
  }
  await revertDailyPanelChange(payload.token);
  revalidateAll();
  return { success: true };
}

export async function actionAddIndividualOrders(
  input: AddIndividualOrdersInput | AddIndividualOrdersEntry[]
) {
  const { entries, acknowledgeSufficientStock } = normalizeAddIndividualOrdersInput(input);
  const user = await getSessionUser();
  if (!user) throw new Error("Wymagane logowanie");

  await assertCanSubmitIndividualOrders(user, entries);

  let salesPersonIdForSales: string | null = null;
  if (isSales(user.role)) {
    const { resolveSalesPersonForUser } = await import("@/lib/auth/sales-person");
    const resolved = await resolveSalesPersonForUser(user);
    if (!resolved) {
      throw new Error(
        "Konto nie jest powiązane z handlowcem — poproś administratora o ustawienie profilu lub e-mail zgodny z kartą handlowca."
      );
    }
    salesPersonIdForSales = resolved.id;
  }

  const normalized = entries.map((e) => ({
    ...e,
    salesPersonId: salesPersonIdForSales ?? e.salesPersonId,
  }));

  const zamowienieLines = normalized.filter(
    (e) => (e.requestKind ?? "zamowienie") === "zamowienie"
  );
  if (zamowienieLines.length) {
    await assertProsbaSubmitStockAllowed({
      lines: zamowienieLines,
      requestKind: "zamowienie",
      acknowledgeSufficientStock,
    });
  }

  const createdBy = user.id === "dev" ? undefined : user.id;
  const submitMode =
    isSales(user.role) || isSalesManager(user.role) ? "sales" : "procurement";
  const result = await batchAddIndividualOrders(normalized, createdBy, { submitMode });
  // Dla handlowców unikamy ciężkiego "revalidateAll" (potrafi trwać długo),
  // bo ich submit dotyczy głównie kilku widoków.
  if (isSales(user.role) || isSalesManager(user.role)) {
    revalidatePath("/moje");
    revalidatePath("/prosba");
    revalidatePath("/podsumowanie");
    revalidatePath("/notatnik");
    revalidatePath("/zk");
    revalidatePath("/weryfikacja");
    revalidatePath("/zeby");
    revalidatePath("/", "layout");
  } else {
    revalidateAll();
  }
  return { success: true, ...result };
}

export async function actionUpdateIndividualRequest(
  orderIds: string[],
  payload: IndividualRequestEditPayload
) {
  const user = await getSessionUser();
  if (!user || (!canAccessOperations(user.role) && !canAccessTeethPanel(user.role))) {
    throw new Error("Brak uprawnień do edycji prośby");
  }
  if (isAdmin(user.role)) {
    await assertAdminPanelAllowsOperationsMutations(user);
  }
  const result = await updateIndividualRequestGroup(orderIds, payload, {});
  revalidateAll();
  return { success: true as const, ...result };
}

export async function actionCompleteVerification(
  orderId: string,
  data: {
    supplierId: string;
    salesPersonId: string;
    symbol?: string;
    mikranCode?: string;
    product: string;
    quantity?: string;
    requestKind?: IndividualRequestKind;
    subiektTwId?: number | null;
    informacjaPath?: InformacjaFlowPath;
    onHand?: number | null;
    reserved?: number | null;
    available?: number | null;
    stockSource?: "subiekt" | null;
    acknowledgeSufficientStock?: boolean;
    teethDetails?: import("@/lib/teeth/teeth-catalog").TeethLineDetail[] | null;
  }
) {
  await requireOperations("mutate");
  const requestKind = data.requestKind ?? "zamowienie";
  if (requestKind === "zamowienie") {
    await assertProsbaSubmitStockAllowed({
      lines: [data],
      requestKind,
      acknowledgeSufficientStock: data.acknowledgeSufficientStock,
    });
  }
  await completeVerificationOrder(orderId, data);
  revalidateAll();
  return { success: true };
}

export async function actionCancelVerification(
  orderId: string,
  procurementCancelNote?: string | null
) {
  await requireOperations("mutate");
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("individual_orders")
    .update(buildProcurementCancelUpdate(procurementCancelNote))
    .eq("id", orderId)
    .eq("status", "Weryfikacja")
    .select("id");
  if (error) {
    throwIfProcurementCancelNoteColumnMissing(error);
    throw new Error(error.message);
  }
  if (!data?.length) {
    throw new Error("Nie znaleziono prośby do anulowania — odśwież listę i spróbuj ponownie.");
  }
  const emailResult = await notifyProcurementCancelForOrders([orderId]);
  revalidateAll();
  return { success: true, ...emailResult };
}

export async function actionCancelOrder(
  orderId: string,
  procurementCancelNote?: string | null
) {
  await requireOperations("mutate");
  const emailResult = await cancelIndividualOrder(orderId, procurementCancelNote);
  revalidateAll();
  return { success: true, ...emailResult };
}

export async function actionUpdateProcurementCancelNote(
  orderId: string,
  note: string | null | undefined
) {
  await requireOperations("mutate");
  const supabase = createAdminClient();
  const { data: raw, error: fetchErr } = await supabase
    .from("individual_orders")
    .select(
      "id, status, sales_cancelled_at, sales_acknowledged_at, procurement_cancel_note"
    )
    .eq("id", orderId)
    .single();
  if (fetchErr) throw new Error(fetchErr.message);
  if (!raw || !canEditProcurementCancelNote(raw)) {
    throw new Error("Nie można edytować wiadomości dla tej pozycji.");
  }

  const normalizedNote = normalizeProcurementCancelNote(note);
  const previousNote = normalizeProcurementCancelNote(raw.procurement_cancel_note);
  const { data, error } = await supabase
    .from("individual_orders")
    .update({ procurement_cancel_note: normalizedNote })
    .eq("id", orderId)
    .select("id");
  if (error) {
    throwIfProcurementCancelNoteColumnMissing(error);
    throw new Error(error.message);
  }
  if (!data?.length) {
    throw new Error("Nie znaleziono pozycji — odśwież listę i spróbuj ponownie.");
  }

  if (normalizedNote === previousNote) {
    revalidateAll();
    return { success: true, emailSent: 0 };
  }

  const emailResult = await notifyProcurementCancelForOrders([orderId], {
    noteUpdated: true,
  });
  revalidateAll();
  return { success: true, ...emailResult };
}

/** Zakupy: ukrycie rezygnacji / wycofania zamówienia dla klienta w panelu dziennym. */
export async function actionAcknowledgeProcurementSalesCancel(
  orderIds: string[]
): Promise<DailyPanelActionResult> {
  await requireOperations("mutate");
  const ids = [...new Set(orderIds.filter(Boolean))];
  if (!ids.length) return { success: true };

  const supabase = createAdminClient();
  const now = new Date().toISOString();

  const { data, error } = await supabase
    .from("individual_orders")
    .select(
      "id, request_kind, sales_cancelled_at, procurement_sales_cancel_ack_at"
    )
    .in("id", ids);

  if (error) {
    if (error.message?.includes("procurement_sales_cancel_ack_at")) {
      throw new Error(
        "Brak kolumny procurement_sales_cancel_ack_at — uruchom supabase/migrations/019_procurement_sales_cancel_ack.sql"
      );
    }
    throw new Error(error.message);
  }

  const toAck = (data ?? []).filter(
    (row) =>
      row.sales_cancelled_at &&
      row.request_kind !== "informacja" &&
      !row.procurement_sales_cancel_ack_at
  );
  if (!toAck.length) return { success: true };

  const { error: updErr } = await supabase
    .from("individual_orders")
    .update({ procurement_sales_cancel_ack_at: now })
    .in(
      "id",
      toAck.map((r) => r.id)
    );
  if (updErr) throw new Error(updErr.message);

  revalidateAll();
  return { success: true };
}

/** Zakupy: oznaczenie prośby jako zapoznanej w panelu dziennym (badge „Nowa”). */
export async function actionMarkProcurementRequestsSeen(
  orderIds: string[]
): Promise<DailyPanelActionResult> {
  await requireOperations("mutate");
  const ids = [...new Set(orderIds.filter(Boolean))];
  if (!ids.length) return { success: true };

  const supabase = createAdminClient();
  const now = new Date().toISOString();

  const { data, error } = await supabase
    .from("individual_orders")
    .select("id, status, procurement_seen_at")
    .in("id", ids);

  if (error) {
    if (error.message?.includes("procurement_seen_at")) {
      throw new Error(
        "Brak kolumny procurement_seen_at — uruchom supabase/migrations/053_procurement_seen_at.sql"
      );
    }
    throw new Error(error.message);
  }

  const toMark = (data ?? []).filter(
    (row) => row.status === "Nowe" && !row.procurement_seen_at
  );
  if (!toMark.length) return { success: true };

  const { error: updErr } = await supabase
    .from("individual_orders")
    .update({ procurement_seen_at: now })
    .in(
      "id",
      toMark.map((r) => r.id)
    );
  if (updErr) throw new Error(updErr.message);

  revalidateAll();
  return { success: true };
}

const DISPOSITION_MIGRATION_HINT =
  "Brak kolumn rozliczenia rezygnacji — uruchom supabase/migrations/021_procurement_cancel_disposition.sql";

/** Zakupy: decyzja po rezygnacji handlowca (stan vs zwrot) — osobno per pozycja. */
export async function actionSetProcurementCancelDisposition(
  entries: ProcurementCancelDispositionInput[],
  options?: { acknowledgeOrderIds?: string[] }
): Promise<DailyPanelActionResult> {
  await requireOperations("mutate");
  const supabase = createAdminClient();
  const now = new Date().toISOString();
  const { isSalesCancelledForQueue } = await import("@/lib/orders/sales-cancel");

  const normalized = entries.filter((e) => e.orderId?.trim());
  const ids = [...new Set(normalized.map((e) => e.orderId))];

  if (ids.length) {
    const { data, error } = await supabase
      .from("individual_orders")
      .select(
        "id, sales_cancelled_at, sales_cancel_phase, procurement_cancel_disposition, status, request_kind"
      )
      .in("id", ids);

    if (error) {
      if (error.message?.includes("procurement_cancel_disposition")) {
        throw new Error(DISPOSITION_MIGRATION_HINT);
      }
      throw new Error(error.message);
    }

    const byId = new Map((data ?? []).map((row) => [row.id, row]));

    for (const entry of normalized) {
      if (entry.disposition !== "to_stock" && entry.disposition !== "return") {
        throw new Error("Nieprawidłowa decyzja magazynu.");
      }

      const row = byId.get(entry.orderId);
      if (!row) {
        throw new Error("Nie znaleziono pozycji rezygnacji.");
      }
      if (!row.sales_cancelled_at || row.procurement_cancel_disposition) {
        continue;
      }
      if (
        !isSalesCancelledForQueue(row as import("@/types/database").IndividualOrder)
      ) {
        continue;
      }

      const trimmedNote = clampOptionalText(entry.note, MAX_DISPOSITION_NOTE_LEN);
      const { data: updated, error: updErr } = await supabase
        .from("individual_orders")
        .update({
          procurement_cancel_disposition: entry.disposition,
          procurement_cancel_disposition_note: trimmedNote,
          procurement_cancel_disposition_at: now,
          procurement_sales_cancel_ack_at: now,
        })
        .eq("id", entry.orderId)
        .is("procurement_cancel_disposition", null)
        .select("id");

      if (updErr) {
        if (updErr.message?.includes("procurement_cancel_disposition")) {
          throw new Error(DISPOSITION_MIGRATION_HINT);
        }
        throw new Error(updErr.message);
      }
      if (!updated?.length) {
        throw new Error("Nie udało się zapisać decyzji — odśwież panel i spróbuj ponownie.");
      }
    }
  }

  const ackIds = [...new Set((options?.acknowledgeOrderIds ?? []).filter(Boolean))];
  if (ackIds.length) {
    const { data: ackRows, error: ackFetchErr } = await supabase
      .from("individual_orders")
      .select("id, request_kind, sales_cancelled_at, procurement_sales_cancel_ack_at")
      .in("id", ackIds);

    if (ackFetchErr) {
      if (ackFetchErr.message?.includes("procurement_sales_cancel_ack_at")) {
        throw new Error(
          "Brak kolumny procurement_sales_cancel_ack_at — uruchom supabase/migrations/019_procurement_sales_cancel_ack.sql"
        );
      }
      throw new Error(ackFetchErr.message);
    }

    const toAck = (ackRows ?? []).filter(
      (row) =>
        row.sales_cancelled_at &&
        row.request_kind !== "informacja" &&
        !row.procurement_sales_cancel_ack_at
    );

    if (toAck.length) {
      const { error: ackUpdErr } = await supabase
        .from("individual_orders")
        .update({ procurement_sales_cancel_ack_at: now })
        .in(
          "id",
          toAck.map((r) => r.id)
        );
      if (ackUpdErr) throw new Error(ackUpdErr.message);
    }
  }

  if (!ids.length && !ackIds.length) return { success: true };

  revalidateAll();
  return { success: true };
}

export async function actionUpdateDelivered(
  orderId: string,
  qty: string,
  teethLineDelivered?: Record<string, number> | null,
) {
  const { requireReceiveMutateForOrders } = await import("@/lib/auth");
  await requireReceiveMutateForOrders([orderId], "mutate");
  const snapshot = await captureDeliverySnapshot(orderId);
  const { emailSent, emailError } = await updateDeliveredQuantity(orderId, qty, {
    teethLineDelivered,
  });
  revalidateAll();

  return {
    success: true,
    emailSent,
    emailError,
    undo: snapshot
      ? buildDeliveryUndoPayload({ kind: "delivery", snapshots: [snapshot] })
      : undefined,
  };
}

const WAREHOUSE_CANCEL_FULFILLED_MIGRATION_HINT =
  "Brak kolumny warehouse_cancel_fulfilled_at — uruchom supabase/migrations/062_warehouse_cancel_fulfilled.sql";

/** Magazyn: rozliczenie rezygnacji (na stan / zwrot / zdjęcie z regału) — pozycja znika z kolejki. */
export async function actionAcknowledgeWarehouseCancelDisposition(
  orderIds: string[]
): Promise<{ success: true; count: number }> {
  const { requireWarehouse } = await import("@/lib/auth");
  await requireWarehouse("mutate");
  const ids = [...new Set(orderIds.filter(Boolean))];
  if (!ids.length) return { success: true, count: 0 };

  const supabase = createAdminClient();
  const now = new Date().toISOString();
  const { canAcknowledgeWarehouseCancelDisposition } = await import(
    "@/lib/orders/warehouse-cancel-fulfillment"
  );

  const { data, error } = await supabase
    .from("individual_orders")
    .select(
      "id, sales_cancelled_at, sales_cancel_phase, procurement_cancel_disposition, warehouse_cancel_fulfilled_at, quantity, delivered_quantity, sales_cancelled_quantity, status, request_kind"
    )
    .in("id", ids);

  if (error) {
    if (error.message?.includes("warehouse_cancel_fulfilled_at")) {
      throw new Error(WAREHOUSE_CANCEL_FULFILLED_MIGRATION_HINT);
    }
    throw new Error(error.message);
  }

  const toAck = (data ?? []).filter((row) =>
    canAcknowledgeWarehouseCancelDisposition(row as import("@/types/database").IndividualOrder)
  );
  if (!toAck.length) {
    throw new Error("Brak pozycji do rozliczenia — przyjmij towar lub sprawdź status rezygnacji.");
  }

  const { error: updErr } = await supabase
    .from("individual_orders")
    .update({ warehouse_cancel_fulfilled_at: now })
    .in(
      "id",
      toAck.map((r) => r.id)
    )
    .is("warehouse_cancel_fulfilled_at", null);

  if (updErr) {
    if (updErr.message?.includes("warehouse_cancel_fulfilled_at")) {
      throw new Error(WAREHOUSE_CANCEL_FULFILLED_MIGRATION_HINT);
    }
    throw new Error(updErr.message);
  }

  revalidateAll();
  return { success: true, count: toAck.length };
}

export async function actionSetWarehouseShelf(orderId: string, shelf: string) {
  const { requireWarehouse } = await import("@/lib/auth");
  await requireWarehouse("mutate");
  const supabase = createAdminClient();
  const trimmed = shelf.trim();
  const { error } = await supabase
    .from("individual_orders")
    .update({ warehouse_shelf: trimmed.length ? trimmed : WAREHOUSE_SHELF_DEFAULT })
    .eq("id", orderId);
  if (error) {
    if (error.message?.includes("warehouse_shelf")) {
      throw new Error(
        "Brak kolumny warehouse_shelf — zastosuj migracje 023 i 024 w Supabase."
      );
    }
    throw new Error(error.message);
  }
  revalidateAll();
  return { success: true };
}

export async function actionBatchUpdateDelivered(
  updates: Array<{ orderId: string; qty: string; teethLineDelivered?: Record<string, number> | null }>
): Promise<
  | {
      success: true;
      saved: number;
      savedOrderIds: string[];
      emailSent: number;
      errors: string[];
      emailError?: string;
      undo?: DeliveryUndoPayload;
    }
  | { error: string }
> {
  if (!updates.length) return { error: "Zaznacz pozycje i wpisz ilości do zapisania." };

  const { requireReceiveMutateForOrders } = await import("@/lib/auth");
  await requireReceiveMutateForOrders(updates.map((u) => u.orderId), "mutate");

  try {
    const snapshots = await captureDeliverySnapshots(updates.map((u) => u.orderId));
    const result = await batchUpdateDeliveredQuantities(
      updates.map((u) => ({
        orderId: u.orderId,
        deliveredQuantity: u.qty,
        teethLineDelivered: u.teethLineDelivered,
      })),
    );
    revalidateAll();

    if (result.saved === 0) {
      return {
        error: result.errors[0] ?? "Nie udało się zapisać żadnej pozycji.",
      };
    }

    const savedSnapshots = snapshots
      .filter((s) => result.savedOrderIds.includes(s.orderId));

    return {
      success: true,
      saved: result.saved,
      savedOrderIds: result.savedOrderIds,
      emailSent: result.emailSent,
      errors: result.errors,
      emailError: result.emailError,
      undo: savedSnapshots.length
        ? buildDeliveryUndoPayload({ kind: "delivery", snapshots: savedSnapshots })
        : undefined,
    };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Nie udało się zapisać." };
  }
}

export async function actionUndoDelivery(payload: DeliveryUndoPayload) {
  const { requireReceiveMutateForOrders } = await import("@/lib/auth");
  await requireReceiveMutateForOrders(
    payload.token.snapshots.map((s) => s.orderId),
    "mutate",
  );
  if (isDeliveryUndoExpired(payload)) {
    throw new Error(`Minął czas na cofnięcie przyjęcia towaru (${undoWindowShortLabel()}).`);
  }
  await revertDeliverySnapshots(payload.token.snapshots);
  await recalculateAllStats();
  revalidateAll();
  return { success: true };
}

export async function actionProcessDeliveries() {
  await requireOperations("mutate");

  const result = await processMarkedDeliveries({ lockedBy: "ops-ui" });
  if (result.skipped) {
    return {
      error: "Przetwarzanie dostaw jest już w toku — poczekaj chwilę i spróbuj ponownie.",
    };
  }

  revalidateAll();
  return {
    success: result.emailFailures.length === 0,
    processed: result.processed,
    emailSent: result.emailSent,
    emailFailures: result.emailFailures,
  };
}

export async function actionRecalculateStats() {
  await requireOperations("mutate");
  const count = await recalculateAllStats();
  revalidateAll();
  return { success: true, count };
}

export async function actionFetchDeliveryStatsDiagnostics() {
  await requireOperations();
  const data = await fetchDeliveryStatsDiagnostics();
  if (!data) {
    return { error: "Brak konfiguracji bazy danych" };
  }
  return { success: true, data };
}

export async function actionUpsertSupplier(form: {
  id?: string;
  name: string;
  location: SupplierLocation;
  pickup_mikran: boolean;
  pickup_pallet: boolean;
  notes: string;
  mails: string;
  extra_info: string;
  interval_raw: string;
  stock_raw: string;
  stats_mode: StatsMode;
  order_on_demand: boolean;
  is_active: boolean;
  default_delivery_carrier?: string | null;
  default_delivery_shipment_form?: string | null;
}) {
  await requireSupplierManagement("mutate");
  const notes = clampText(form.notes, MAX_SUPPLIER_NOTES_LEN);
  const mails = clampText(form.mails, MAX_SUPPLIER_MAILS_LEN);
  const extraInfo = clampText(form.extra_info, MAX_SUPPLIER_EXTRA_LEN);
  const contactError = validateSupplierContactFields(notes, mails, extraInfo);
  if (contactError) {
    throw new Error(contactError);
  }
  const supabase = createAdminClient();
  const intervalRaw = clampText(form.interval_raw, MAX_INTERVAL_RAW_LEN);
  const stockRaw = clampText(form.stock_raw, MAX_INTERVAL_RAW_LEN);
  const intervalParsed = parseInterval(intervalRaw);
  const stockParsed = parseInterval(stockRaw);
  const payload: Record<string, unknown> = {
    name: clampText(form.name, MAX_SUPPLIER_NAME_LEN),
    location: form.location,
    pickup_mikran: form.pickup_mikran,
    pickup_pallet: form.pickup_pallet,
    notes,
    mails,
    extra_info: extraInfo,
    interval_raw: intervalRaw,
    interval_weeks: intervalWeeksForStorage(intervalRaw, intervalParsed),
    stock_raw: stockRaw,
    stock: intervalWeeksForStorage(stockRaw, stockParsed),
    stats_mode: form.stats_mode,
    order_on_demand: resolveOrderOnDemandForSave({
      order_on_demand: form.order_on_demand,
      stock_raw: stockRaw,
      interval_raw: intervalRaw,
      extra_info: extraInfo,
    }),
    is_active: form.is_active,
    updated_at: new Date().toISOString(),
  };

  // Pola magazynowe pomijamy przy częściowym zapisie (np. modal z panelu dziennego).
  if (form.default_delivery_carrier !== undefined) {
    payload.default_delivery_carrier = form.default_delivery_carrier?.trim()
      ? await assertWarehouseCarrierSlug(form.default_delivery_carrier)
      : null;
  }
  if (form.default_delivery_shipment_form !== undefined) {
    payload.default_delivery_shipment_form = form.default_delivery_shipment_form?.trim()
      ? parseWarehouseShipmentForm(form.default_delivery_shipment_form)
      : null;
  }

  if (form.id) {
    const { error } = await supabase.from("suppliers").update(payload).eq("id", form.id);
    if (error) throw new Error(error.message);
    if (payload.is_active) {
      await recalcSingleSupplierSchedule(form.id);
    }
    revalidateAll();
    return { success: true as const, id: form.id };
  }

  const { data, error: insertError } = await supabase
    .from("suppliers")
    .insert(payload)
    .select("id")
    .single();
  if (insertError) throw new Error(insertError.message);
  if (data) {
    await supabase.from("supplier_schedules").insert({ supplier_id: data.id });
    await recalcSingleSupplierSchedule(data.id);
  }
  revalidateAll();
  return { success: true as const, id: data?.id ?? "" };
}

export async function actionSetSupplierActive(
  id: string,
  isActive: boolean
): Promise<{ success: true }> {
  await requireSupplierManagement("mutate");
  const supabase = createAdminClient();
  const { error } = await supabase
    .from("suppliers")
    .update({ is_active: isActive, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw new Error(error.message);
  if (isActive) {
    await recalcSingleSupplierSchedule(id);
  }
  revalidateAll();
  return { success: true };
}

export async function actionDeleteSupplier(
  id: string
): Promise<{ success: true } | { error: string }> {
  await requireAdminForMutation();
  const supabase = createAdminClient();

  const { data: supplier } = await supabase
    .from("suppliers")
    .select("name")
    .eq("id", id)
    .maybeSingle();
  if (!supplier) return { error: "Nie znaleziono dostawcy." };

  const { count: orderCount } = await supabase
    .from("individual_orders")
    .select("id", { count: "exact", head: true })
    .eq("supplier_id", id);

  if ((orderCount ?? 0) > 0) {
    return {
      error: `Nie można usunąć „${supplier.name}" — ma ${orderCount} zamówień w historii.`,
    };
  }

  const { error } = await supabase.from("suppliers").delete().eq("id", id);
  if (error) return { error: error.message };

  revalidateAll();
  return { success: true };
}

export async function actionFetchSupplierRecentHistory(supplierId: string) {
  await requireOperations();
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("normal_order_history")
    .select("action_at, action, user_email, next_date")
    .eq("supplier_id", supplierId)
    .order("action_at", { ascending: false })
    .limit(8);
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function actionListActiveVacationsForSupplier(supplierId: string) {
  await requireSupplierManagement("read");
  const supabase = createAdminClient();
  const todayKey = todayDateKeyInWarsaw();
  const { data, error } = await supabase
    .from("vacations")
    .select("id, start_date, end_date, last_order_date, active")
    .eq("supplier_id", supplierId)
    .eq("active", true)
    .gte("end_date", todayKey)
    .order("start_date", { ascending: true });
  if (error) throw new Error(error.message);
  return { vacations: data ?? [], todayKey };
}

/** @deprecated Użyj actionListActiveVacationsForSupplier — zwraca tylko pierwszy wpis. */
export async function actionGetEditableVacationForSupplier(supplierId: string) {
  const { vacations } = await actionListActiveVacationsForSupplier(supplierId);
  return vacations[0] ?? null;
}

export async function actionUpsertVacation(form: {
  id?: string;
  supplier_id: string;
  start_date: string;
  end_date: string;
  last_order_date: string;
  active: boolean;
}) {
  await requireSupplierManagement("mutate");

  const todayKey = todayDateKeyInWarsaw();
  const validation = validateVacationFormInput(form, todayKey);
  if (validation.error) {
    throw new Error(validation.error);
  }

  const supabase = createAdminClient();

  const { data: existing, error: existingErr } = await supabase
    .from("vacations")
    .select("id, start_date, end_date, last_order_date, active")
    .eq("supplier_id", form.supplier_id)
    .eq("active", true);
  if (existingErr) throw new Error(existingErr.message);

  const overlapError = validateVacationOverlap(form, existing ?? []);
  if (overlapError) {
    throw new Error(overlapError);
  }

  const payload = {
    supplier_id: form.supplier_id,
    start_date: form.start_date,
    end_date: form.end_date,
    last_order_date: form.last_order_date,
    active: form.active,
  };
  const write = form.id
    ? await supabase.from("vacations").update(payload).eq("id", form.id).select("id, active").single()
    : await supabase.from("vacations").insert(payload).select("id, active").single();
  if (write.error) {
    throw new Error(write.error.message);
  }

  const expiredSupplierIds = await deactivateExpiredVacations();
  const recalcTargets = new Set([form.supplier_id, ...expiredSupplierIds]);
  const recalcErrors: string[] = [];
  for (const supplierId of recalcTargets) {
    try {
      await recalcSingleSupplierSchedule(supplierId);
    } catch (e) {
      recalcErrors.push(
        e instanceof Error ? e.message : "Błąd przeliczenia harmonogramu"
      );
    }
  }

  const savedId = form.id ?? write.data?.id;
  let persistedActive = write.data?.active ?? form.active;
  if (savedId) {
    const { data: savedRow } = await supabase
      .from("vacations")
      .select("active")
      .eq("id", savedId)
      .maybeSingle();
    if (savedRow) persistedActive = savedRow.active;
  }

  const [{ data: supplier }, { data: schedule }] = await Promise.all([
    supabase.from("suppliers").select("name").eq("id", form.supplier_id).single(),
    supabase
      .from("supplier_schedules")
      .select("computed_next_date, vacation_note")
      .eq("supplier_id", form.supplier_id)
      .maybeSingle(),
  ]);

  revalidateAll();

  return {
    success: true as const,
    processed: recalcTargets.size,
    syncErrors: recalcErrors,
    supplierName: supplier?.name ?? "Dostawca",
    nextDate: schedule?.computed_next_date ?? null,
    vacationNote: schedule?.vacation_note ?? null,
    active: persistedActive,
    id: savedId ?? null,
  };
}

export async function actionPreviewVacationImpact(form: {
  id?: string;
  supplier_id: string;
  start_date: string;
  end_date: string;
  last_order_date: string;
  active: boolean;
}) {
  await requireSupplierManagement("read");

  if (
    !form.supplier_id ||
    !form.start_date ||
    !form.end_date ||
    !form.last_order_date
  ) {
    return { preview: null, validationError: null };
  }

  const supabase = createAdminClient();
  const [{ data: supplier, error: supplierErr }, { data: vacations, error: vacErr }] =
    await Promise.all([
      supabase
        .from("suppliers")
        .select("location, interval_raw, interval_weeks, supplier_schedules(order_date, shift_date)")
        .eq("id", form.supplier_id)
        .single(),
      supabase
        .from("vacations")
        .select("id, start_date, end_date, last_order_date, active")
        .eq("supplier_id", form.supplier_id),
    ]);

  if (supplierErr || !supplier) {
    throw new Error(supplierErr?.message ?? "Nie znaleziono dostawcy.");
  }
  if (vacErr) throw new Error(vacErr.message);

  const todayKey = todayDateKeyInWarsaw();
  const validation = validateVacationFormInput(form, todayKey);
  if (validation.error) {
    return { preview: null, validationError: validation.error };
  }

  const activeRows = (vacations ?? []).filter((row) => row.active);
  const overlapError = validateVacationOverlap(form, activeRows);
  if (overlapError) {
    return { preview: null, validationError: overlapError };
  }

  const schedule = supplierScheduleForPreview(supplier);
  const preview = computeVacationSchedulePreview({
    ...schedule,
    dbVacationRows: vacations ?? [],
    proposed: form,
  });

  return { preview, validationError: null };
}

export async function actionDeleteVacation(id: string) {
  await requireSupplierManagement("mutate");

  const supabase = createAdminClient();
  const todayKey = todayDateKeyInWarsaw();

  const { data: row, error } = await supabase
    .from("vacations")
    .select("id, supplier_id, active, end_date")
    .eq("id", id)
    .single();

  if (error || !row) {
    throw new Error("Nie znaleziono urlopu.");
  }
  if (row.active && row.end_date >= todayKey) {
    throw new Error(
      "Nie można usunąć aktywnego urlopu. Wyłącz go lub poczekaj do końca okresu."
    );
  }

  const { error: deleteErr } = await supabase.from("vacations").delete().eq("id", id);
  if (deleteErr) throw new Error(deleteErr.message);

  try {
    await recalcSingleSupplierSchedule(row.supplier_id);
  } catch (e) {
    throw new Error(
      e instanceof Error ? e.message : "Urlop usunięty, ale przeliczenie harmonogramu nie powiodło się."
    );
  }

  revalidateAll();
  return { success: true as const, supplierId: row.supplier_id };
}

export async function actionUpsertSalesPerson(form: {
  id?: string;
  name: string;
  email: string;
  groupId?: string | null;
}): Promise<{ success: true; id: string } | { error: string }> {
  const actor = await requireAdminOrSalesTeamManagement("mutate");

  const name = form.name.trim();
  const email = form.email.trim().toLowerCase();
  if (!name) return { error: "Podaj imię i nazwisko handlowca." };
  if (!email) return { error: "Podaj adres e-mail." };
  if (!isValidEmail(email)) {
    return { error: "Podaj poprawny adres e-mail." };
  }

  const supabase = createAdminClient();

  const duplicateQuery = supabase
    .from("sales_people")
    .select("id, name")
    .ilike("email", email);
  if (form.id) duplicateQuery.neq("id", form.id);
  const { data: duplicate } = await duplicateQuery.maybeSingle();
  if (duplicate) {
    return { error: `Ten e-mail jest już przypisany do handlowca „${duplicate.name}".` };
  }

  const groupId = form.groupId?.trim() ? form.groupId.trim() : null;
  if (groupId) {
    const { data: group } = await supabase
      .from("sales_groups")
      .select("id")
      .eq("id", groupId)
      .maybeSingle();
    if (!group) return { error: "Wybrana grupa nie istnieje." };
  }

  if (!isAdmin(actor.role)) {
    if (!form.id) {
      return {
        error:
          "Kierownik nie może tworzyć samych kart handlowca — użyj formularza w sekcji Handlowcy (konto zakładane automatycznie).",
      };
    }
    const allowed = await canAccessSalesPerson(actor, form.id);
    if (!allowed) {
      return { error: "Nie masz uprawnień do edycji tego handlowca." };
    }
    try {
      await assertManagerRequiresGroupInScope(actor, groupId);
    } catch (e) {
      return { error: e instanceof Error ? e.message : "Brak uprawnień do grupy." };
    }
  }

  if (form.id) {
    const { error } = await supabase
      .from("sales_people")
      .update({ name, email, group_id: groupId })
      .eq("id", form.id);
    if (error) return { error: error.message };

    const syncError = await syncLinkedSalesPersonLoginEmail(supabase, form.id, email);
    if (syncError) {
      return { error: `Zapisano kartę, ale nie udało się zsynchronizować konta: ${syncError}` };
    }
  } else {
    const { data: inserted, error } = await supabase
      .from("sales_people")
      .insert({ name, email, group_id: groupId })
      .select("id")
      .single();
    if (error) return { error: error.message };
    revalidateAll();
    return { success: true, id: inserted.id };
  }

  revalidateAll();
  return { success: true, id: form.id };
}

export async function actionDeleteSalesPerson(
  id: string
): Promise<{ success: true } | { error: string }> {
  const actor = await requireAdminOrSalesTeamManagement("mutate");
  const supabase = createAdminClient();

  const { data: person } = await supabase
    .from("sales_people")
    .select("name")
    .eq("id", id)
    .maybeSingle();
  if (!person) return { error: "Nie znaleziono handlowca." };

  if (!isAdmin(actor.role)) {
    return { error: "Usuwanie handlowców jest dostępne tylko dla administratora." };
  }

  const { count: orderCount } = await supabase
    .from("individual_orders")
    .select("id", { count: "exact", head: true })
    .eq("sales_person_id", id);

  if ((orderCount ?? 0) > 0) {
    return {
      error: `Nie można usunąć „${person.name}" — ma ${orderCount} zamówień w systemie. Zostaw kartę handlowca w bazie.`,
    };
  }

  const { data: linkedProfile } = await supabase
    .from("profiles")
    .select("email")
    .eq("sales_person_id", id)
    .maybeSingle();

  if (linkedProfile) {
    return {
      error: `Najpierw usuń lub zmień konto użytkownika (${linkedProfile.email ?? "powiązane"}).`,
    };
  }

  const { error } = await supabase.from("sales_people").delete().eq("id", id);
  if (error) return { error: error.message };

  revalidateAll();
  return { success: true };
}

function snapDateIso(iso: string | null): string | null {
  if (!iso) return null;
  const parsed = parseDateOnly(iso);
  if (!parsed) return null;
  return dateToIso(snapToBusinessDay(parsed));
}

export async function actionUpdateScheduleDates(
  supplierId: string,
  patch: {
    orderDate?: string | null;
    nextDate?: string | null;
    shiftDate?: string | null;
  }
) {
  await requireOperations("mutate");
  const supabase = createAdminClient();

  const { data: current, error: currentErr } = await supabase
    .from("supplier_schedules")
    .select("order_date, shift_date")
    .eq("supplier_id", supplierId)
    .maybeSingle();
  if (currentErr) throw new Error(currentErr.message);

  const orderDate =
    patch.orderDate !== undefined ? snapDateIso(patch.orderDate) : current?.order_date ?? null;
  let shiftDate =
    patch.shiftDate !== undefined ? snapDateIso(patch.shiftDate) : current?.shift_date ?? null;

  if (patch.nextDate !== undefined) {
    shiftDate = snapDateIso(patch.nextDate);
  }

  await supabase.from("supplier_schedules").upsert(
    {
      supplier_id: supplierId,
      order_date: orderDate,
      shift_date: shiftDate,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "supplier_id" }
  );
  await recalcSingleSupplierSchedule(supplierId);
  revalidateAll();
  return { success: true };
}

export async function actionGetSystemStatus() {
  await requireAdmin();

  const { hasSupabaseConfig } = await import("@/lib/supabase/admin");
  const { isAppUrlProductionReady, isProductionRuntime, getCronSecret } = await import(
    "@/lib/env/app-config"
  );

  if (!hasSupabaseConfig()) {
    return { isHealthy: false, issues: ["Brak konfiguracji Supabase (.env.local)"] };
  }
  const supabase = createAdminClient();
  const issues: string[] = [];

  if (isProductionRuntime()) {
    if (!isAppUrlProductionReady()) {
      issues.push(
        "NEXT_PUBLIC_APP_URL musi być https:// lub wewnętrzna domena HTTP (np. ontime.mikran.pl)"
      );
    }
    if (!getCronSecret()) {
      issues.push("Ustaw silny CRON_SECRET (nie change-me-in-production)");
    }
  }
  const tables = ["suppliers", "sales_people", "supplier_schedules"];
  for (const t of tables) {
    const { count, error } = await supabase.from(t).select("*", { count: "exact", head: true });
    if (error) issues.push(`Błąd ${t}: ${error.message}`);
    if (count === 0 && t === "suppliers") issues.push("Brak dostawców");
    if (count === 0 && t === "sales_people") issues.push("Brak handlowców");
  }

  const { isEmailConfigured } = await import("@/lib/env/email-config");
  if (!isEmailConfigured()) {
    issues.push(
      "Brak RESEND_API_KEY — e-maile wyłączone (ustaw w .env.local i zrestartuj dev)"
    );
  }

  const { runSchemaChecks } = await import("@/lib/supabase/schema-check");
  const schema = await runSchemaChecks(supabase);
  issues.push(...schema.issues);

  const { data: allSalesPeople } = await supabase
    .from("sales_people")
    .select("name, email");
  for (const p of allSalesPeople ?? []) {
    if (!p.email?.trim()) {
      issues.push(`Handlowiec „${p.name}" bez e-maila — uzupełnij w Admin → Handlowcy`);
    }
  }

  const { data: unlinkedSalesUsers } = await supabase
    .from("profiles")
    .select("email")
    .eq("role", "sales")
    .is("sales_person_id", null);
  for (const u of unlinkedSalesUsers ?? []) {
    issues.push(
      `Konto handlowca ${u.email ?? "(bez e-maila)"} bez powiązania z kartą handlowca`
    );
  }

  return { isHealthy: issues.length === 0, issues };
}

export async function actionGetCronMonitorStatus() {
  await requireAdmin();
  const { fetchCronMonitorSnapshot } = await import("@/lib/services/cron-monitor");
  return fetchCronMonitorSnapshot();
}
