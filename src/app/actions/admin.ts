"use server";

import { revalidatePath } from "next/cache";
import {
  requireAdmin,
  requireAdminOrSalesTeamManagement,
  requireOperations,
  requireSupplierManagement,
  getSessionUser,
} from "@/lib/auth";
import { canAccessOperations, isAdmin, isSales, isSalesManager } from "@/lib/auth-roles";
import {
  assertManagerCanUseGroupId,
  canAccessSalesPerson,
} from "@/lib/data/sales-group-access";
import { tryAcquireLock, releaseLock } from "@/lib/services/locks";
import {
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
} from "@/lib/services/orders";
import type { IndividualRequestEditPayload } from "@/lib/orders/individual-request-edit";
import { sendWeeklySummaryEmail } from "@/lib/services/email";
import { createAdminClient } from "@/lib/supabase/admin";
import { intervalWeeksForStorage, parseInterval } from "@/lib/orders/dates";
import { resolveOrderOnDemandForSave } from "@/lib/orders/supplier-on-demand";
import { WAREHOUSE_SHELF_DEFAULT } from "@/lib/orders/warehouse-inventory";
import { validateSupplierContactFields } from "@/lib/orders/validate-supplier-contact";
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
import { DAILY_PANEL_UNDO_MS } from "@/lib/orders/daily-panel-undo";
import type { DailyPanelActionResult } from "@/lib/orders/daily-panel-undo";
import type { DailyPanelUndoPayload } from "@/lib/orders/daily-panel-undo";
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
  revalidatePath("/");
  revalidatePath("/podsumowanie");
  revalidatePath("/kolejka");
  revalidatePath("/historia");
  revalidatePath("/moje");
  revalidatePath("/plan");
  revalidatePath("/prosba");
  revalidatePath("/weryfikacja");
  revalidatePath("/lokalizacje/[location]", "page");
  revalidatePath("/admin");
  revalidatePath("/admin/handlowcy");
  revalidatePath("/admin/uzytkownicy");
}

export async function actionDeleteIndividualHistory(orderId: string) {
  await requireAdmin();
  const supabase = createAdminClient();
  await supabase.from("individual_orders").delete().eq("id", orderId);
  revalidateAll();
  return { success: true };
}

export async function actionDeleteNormalHistory(historyId: string) {
  await requireAdmin();
  const supabase = createAdminClient();
  await supabase.from("normal_order_history").delete().eq("id", historyId);
  revalidateAll();
  return { success: true };
}

export async function actionSyncData() {
  await requireSupplierManagement();
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
  const user = await requireOperations();
  const scheduleBefore = await captureScheduleSnapshot(supplierId);
  await markStandardOrdered(supplierId, user.email);
  const feedbackLines = await buildMarkOrderedFeedback([supplierId]);
  revalidateAll();
  return {
    success: true,
    feedbackLines,
    undo: {
      token: { kind: "schedules", snapshots: [scheduleBefore] },
      performedAt: Date.now(),
    },
  };
}

export async function actionShiftOrder(
  supplierId: string,
  weeks: number | null,
  manualDateIso: string | null
): Promise<DailyPanelActionResult> {
  const user = await requireOperations();
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
    undo: {
      token: { kind: "schedules", snapshots: [scheduleBefore] },
      performedAt: Date.now(),
    },
  };
}

/** Zatwierdzenie planu tygodnia z trybu drag-and-drop (wszystkie przesunięcia naraz). */
export async function actionBatchShiftOrder(
  changes: Array<{ supplierId: string; manualDateIso: string }>
): Promise<DailyPanelActionResult> {
  const user = await requireOperations();
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
    undo: {
      token: { kind: "schedules", snapshots },
      performedAt: Date.now(),
    },
  };
}

export async function actionProcessIndividual(
  orderIds: string[],
  action: "GLOWNE" | "POBOCZNE" | "ANULOWANO"
): Promise<DailyPanelActionResult> {
  const user = await requireOperations();
  const individualsBefore = await captureIndividualOrdersSnapshot(orderIds);
  const glowneSupplierIds =
    action === "GLOWNE" ? await supplierIdsForGlownePlacement(orderIds) : [];
  const scheduleBefore =
    action === "GLOWNE"
      ? await captureScheduleSnapshots(glowneSupplierIds)
      : [];

  await processIndividualFromSummary(orderIds, action, user.email);
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
    undo: { token, performedAt: Date.now() },
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
  await requireOperations();
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
  const user = await requireOperations();
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
    undo: {
      token: { kind: "schedules", snapshots: schedulesBefore },
      performedAt: Date.now(),
    },
  };
}

export async function actionUndoDailyPanelChange(payload: DailyPanelUndoPayload) {
  await requireOperations();
  if (Date.now() - payload.performedAt > DAILY_PANEL_UNDO_MS) {
    throw new Error("Minął czas na cofnięcie (5 s). Odśwież panel.");
  }
  await revertDailyPanelChange(payload.token);
  revalidateAll();
  return { success: true };
}

export async function actionAddIndividualOrders(
  entries: Array<{
    supplierId?: string;
    salesPersonId: string;
    symbol?: string;
    mikranCode?: string;
    product?: string;
    quantity?: string;
    requestKind?: IndividualRequestKind;
    clientName?: string;
    subiektTwId?: number | null;
  }>
) {
  const user = await getSessionUser();
  if (!user) throw new Error("Wymagane logowanie");
  if (
    !canAccessOperations(user.role) &&
    !isSales(user.role) &&
    !isSalesManager(user.role)
  ) {
    throw new Error("Brak uprawnień");
  }

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

  if (isSalesManager(user.role)) {
    for (const e of entries) {
      if (!e.salesPersonId) {
        throw new Error("Wybierz handlowca, w imieniu którego składasz prośbę.");
      }
      const allowed = await canAccessSalesPerson(user, e.salesPersonId);
      if (!allowed) {
        throw new Error(
          "Nie masz uprawnień do składania prośby dla tego handlowca. Kierownik może składać prośby dla siebie (własna karta handlowca) oraz dla osób z przypisanych grup zespołu — poproś administratora o grupy przy koncie kierownika i grupę przy karcie handlowca."
        );
      }
    }
  }

  const normalized = entries.map((e) => ({
    ...e,
    salesPersonId: salesPersonIdForSales ?? e.salesPersonId,
  }));
  const createdBy = user.id === "dev" ? undefined : user.id;
  const result = await batchAddIndividualOrders(normalized, createdBy);
  revalidateAll();
  return { success: true, ...result };
}

export async function actionUpdateIndividualRequest(
  orderIds: string[],
  payload: IndividualRequestEditPayload
) {
  await requireOperations();
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
  }
) {
  await requireOperations();
  await completeVerificationOrder(orderId, data);
  revalidateAll();
  return { success: true };
}

export async function actionCancelVerification(orderId: string) {
  await requireOperations();
  const supabase = createAdminClient();
  const { error } = await supabase
    .from("individual_orders")
    .update({ status: "Anulowane" })
    .eq("id", orderId)
    .eq("status", "Weryfikacja");
  if (error) throw new Error(error.message);
  revalidateAll();
  return { success: true };
}

export async function actionCancelOrder(orderId: string) {
  await requireOperations();
  await cancelIndividualOrder(orderId);
  revalidateAll();
  return { success: true };
}

/** Zakupy: ukrycie rezygnacji / wycofania zamówienia dla klienta w panelu dziennym. */
export async function actionAcknowledgeProcurementSalesCancel(
  orderIds: string[]
): Promise<DailyPanelActionResult> {
  await requireOperations();
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

const DISPOSITION_MIGRATION_HINT =
  "Brak kolumn rozliczenia rezygnacji — uruchom supabase/migrations/021_procurement_cancel_disposition.sql";

/** Magazyn: decyzja po rezygnacji handlowca (stan vs zwrot). */
export async function actionSetProcurementCancelDisposition(
  orderIds: string[],
  disposition: "to_stock" | "return",
  note?: string
): Promise<DailyPanelActionResult> {
  await requireOperations();
  const ids = [...new Set(orderIds.filter(Boolean))];
  if (!ids.length) return { success: true };

  if (disposition !== "to_stock" && disposition !== "return") {
    throw new Error("Nieprawidłowa decyzja magazynu.");
  }

  const supabase = createAdminClient();
  const now = new Date().toISOString();
  const trimmedNote = clampOptionalText(note, MAX_DISPOSITION_NOTE_LEN);

  const { data, error } = await supabase
    .from("individual_orders")
    .select(
      "id, sales_cancelled_at, sales_cancel_phase, procurement_cancel_disposition, status"
    )
    .in("id", ids);

  if (error) {
    if (error.message?.includes("procurement_cancel_disposition")) {
      throw new Error(DISPOSITION_MIGRATION_HINT);
    }
    throw new Error(error.message);
  }

  const { isSalesCancelledForQueue } = await import("@/lib/orders/sales-cancel");
  const toUpdate = (data ?? []).filter((row) => {
    if (!row.sales_cancelled_at || row.procurement_cancel_disposition) return false;
    return isSalesCancelledForQueue(row as import("@/types/database").IndividualOrder);
  });

  if (!toUpdate.length) return { success: true };

  const { error: updErr } = await supabase
    .from("individual_orders")
    .update({
      procurement_cancel_disposition: disposition,
      procurement_cancel_disposition_note: trimmedNote,
      procurement_cancel_disposition_at: now,
      procurement_sales_cancel_ack_at: now,
    })
    .in(
      "id",
      toUpdate.map((r) => r.id)
    );

  if (updErr) {
    if (updErr.message?.includes("procurement_cancel_disposition")) {
      throw new Error(DISPOSITION_MIGRATION_HINT);
    }
    throw new Error(updErr.message);
  }

  revalidateAll();
  return { success: true };
}

export async function actionUpdateDelivered(orderId: string, qty: string) {
  await requireOperations();
  const { emailSent, emailError } = await updateDeliveredQuantity(orderId, qty);
  revalidateAll();
  return { success: true, emailSent, emailError };
}

export async function actionSetWarehouseShelf(orderId: string, shelf: string) {
  await requireOperations();
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
  updates: Array<{ orderId: string; qty: string }>
): Promise<
  | {
      success: true;
      saved: number;
      savedOrderIds: string[];
      emailSent: number;
      errors: string[];
      emailError?: string;
    }
  | { error: string }
> {
  await requireOperations();
  if (!updates.length) return { error: "Zaznacz pozycje i wpisz ilości do zapisania." };

  try {
    const result = await batchUpdateDeliveredQuantities(
      updates.map((u) => ({ orderId: u.orderId, deliveredQuantity: u.qty }))
    );
    revalidateAll();

    if (result.saved === 0) {
      return {
        error: result.errors[0] ?? "Nie udało się zapisać żadnej pozycji.",
      };
    }

    return {
      success: true,
      saved: result.saved,
      savedOrderIds: result.savedOrderIds,
      emailSent: result.emailSent,
      errors: result.errors,
      emailError: result.emailError,
    };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Nie udało się zapisać." };
  }
}

export async function actionProcessDeliveries() {
  await requireOperations();
  const result = await processMarkedDeliveries();
  revalidateAll();
  return {
    success: result.emailFailures.length === 0,
    processed: result.processed,
    emailSent: result.emailSent,
    emailFailures: result.emailFailures,
  };
}

export async function actionRecalculateStats() {
  await requireOperations();
  const count = await recalculateAllStats();
  revalidateAll();
  return { success: true, count };
}

export async function actionSendWeeklyEmail() {
  await requireAdmin();
  const ok = await sendWeeklySummaryEmail();
  return { success: ok };
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
}) {
  await requireSupplierManagement();
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
  const payload = {
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
    updated_at: new Date().toISOString(),
  };

  if (form.id) {
    await supabase.from("suppliers").update(payload).eq("id", form.id);
    await recalcSingleSupplierSchedule(form.id);
    revalidateAll();
    return { success: true as const, id: form.id };
  }

  const { data } = await supabase.from("suppliers").insert(payload).select("id").single();
  if (data) {
    await supabase.from("supplier_schedules").insert({ supplier_id: data.id });
    await recalcSingleSupplierSchedule(data.id);
  }
  revalidateAll();
  return { success: true as const, id: data?.id ?? "" };
}

export async function actionDeleteSupplier(
  id: string
): Promise<{ success: true } | { error: string }> {
  await requireAdmin();
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

export async function actionUpsertVacation(form: {
  id?: string;
  supplier_id: string;
  start_date: string;
  end_date: string;
  last_order_date: string;
  active: boolean;
}) {
  await requireSupplierManagement();

  const start = parseDateOnly(form.start_date);
  const end = parseDateOnly(form.end_date);
  const lastOrder = parseDateOnly(form.last_order_date);
  if (!start || !end || !lastOrder) {
    throw new Error("Podaj poprawne daty urlopu (od, do, ostatnie zamówienie).");
  }
  if (start > end) {
    throw new Error("Data „urlop od” nie może być późniejsza niż „urlop do”.");
  }
  if (lastOrder > start) {
    throw new Error(
      "„Ostatnie zamówienie przed urlopem” powinno być w dniu rozpoczęcia urlopu lub wcześniej."
    );
  }

  const supabase = createAdminClient();
  const payload = {
    supplier_id: form.supplier_id,
    start_date: form.start_date,
    end_date: form.end_date,
    last_order_date: form.last_order_date,
    active: form.active,
  };
  const write = form.id
    ? await supabase.from("vacations").update(payload).eq("id", form.id)
    : await supabase.from("vacations").insert(payload);
  if (write.error) {
    throw new Error(write.error.message);
  }

  const sync = await syncSuppliersFromSettings();

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
    processed: sync.processed,
    syncErrors: sync.errors,
    supplierName: supplier?.name ?? "Dostawca",
    nextDate: schedule?.computed_next_date ?? null,
    vacationNote: schedule?.vacation_note ?? null,
    active: form.active,
  };
}

export async function actionUpsertSalesPerson(form: {
  id?: string;
  name: string;
  email: string;
  groupId?: string | null;
}): Promise<{ success: true; id: string } | { error: string }> {
  const actor = await requireAdminOrSalesTeamManagement();

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
    .eq("email", email);
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
    if (form.id) {
      const allowed = await canAccessSalesPerson(actor, form.id);
      if (!allowed) {
        return { error: "Nie masz uprawnień do edycji tego handlowca." };
      }
    }
    try {
      await assertManagerCanUseGroupId(actor, groupId);
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
  const actor = await requireAdminOrSalesTeamManagement();
  const supabase = createAdminClient();

  const { data: person } = await supabase
    .from("sales_people")
    .select("name")
    .eq("id", id)
    .maybeSingle();
  if (!person) return { error: "Nie znaleziono handlowca." };

  if (!isAdmin(actor.role)) {
    const allowed = await canAccessSalesPerson(actor, id);
    if (!allowed) {
      return { error: "Nie masz uprawnień do usunięcia tego handlowca." };
    }
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
  orderDate: string | null,
  nextDate: string | null,
  shiftDate: string | null
) {
  await requireOperations();
  const supabase = createAdminClient();
  await supabase.from("supplier_schedules").upsert(
    {
      supplier_id: supplierId,
      order_date: snapDateIso(orderDate),
      computed_next_date: snapDateIso(nextDate),
      shift_date: snapDateIso(shiftDate),
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
      issues.push("NEXT_PUBLIC_APP_URL musi wskazywać produkcyjną domenę https://");
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
