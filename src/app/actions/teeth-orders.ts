"use server";

// @service-role-ok — autoryzacja require*(); service role z pełnym scope po warstwie aplikacji.

import { revalidatePath } from "next/cache";
import { requireTeethPanel } from "@/lib/auth";
import {
  fetchTeethQueue,
  fetchTeethHistoryGroups,
  fetchTeethHistoryPage,
  markTeethOrdered,
  markTeethPositionsOrdered,
  unmarkTeethOrdered,
  overrideTeethDeliveryDate,
  clearTeethDeliveryDateOverride,
  fetchTeethVerificationQueue,
  countTeethVerificationQueue,
  approveTeethOcr,
  isScheduledItem,
  type TeethHistoryFetchOptions,
  type TeethQueueGroup,
  type TeethQueueItem,
  type TeethPositionSelection,
} from "@/lib/data/teeth-queue";
import { fetchTeethOrderEditContext, type TeethEditContext } from "@/lib/data/teeth-edit-context";
import {
  fetchTeethOrderHistoryAudit,
  type TeethOrderHistoryRow,
} from "@/lib/data/teeth-order-history";
import {
  fetchTeethSchedules,
  fetchTeethScheduleForSupplier,
  upsertTeethSchedule,
  removeTeethSchedule,
  shiftTeethSchedule,
  markTeethScheduleOrdered,
  fetchAvailableSuppliersForTeethSchedule,
} from "@/lib/data/teeth-schedule";
import type { DayOfWeek, TeethSupplierSchedule, TeethSupplierScheduleWithSupplier } from "@/types/database";
import type { SessionUser } from "@/lib/auth";
import { assertMaxBatchSize, MAX_BATCH_ORDER_LINES } from "@/lib/security/text-limits";

function teethHistoryActor(user: SessionUser) {
  return { id: user.id, email: user.email };
}

function revalidateTeethSupplierPaths() {
  revalidatePath("/zeby");
  revalidatePath("/zakupy/dostawcy");
}

export type TeethQueueResult = {
  groups: TeethQueueGroup[];
};

export async function actionFetchTeethQueue(): Promise<TeethQueueResult> {
  await requireTeethPanel("read");
  const groups = await fetchTeethQueue();
  return { groups };
}

export async function actionFetchTeethHistoryGroups(
  options?: TeethHistoryFetchOptions
): Promise<TeethQueueGroup[]> {
  await requireTeethPanel("read");
  return fetchTeethHistoryGroups(options);
}

export async function actionFetchTeethHistoryPage(
  options?: TeethHistoryFetchOptions
): Promise<Awaited<ReturnType<typeof fetchTeethHistoryPage>>> {
  await requireTeethPanel("read");
  return fetchTeethHistoryPage(options);
}

export async function actionFetchTeethOrderHistoryAudit(
  options?: { limit?: number; supplierId?: string | null }
): Promise<TeethOrderHistoryRow[]> {
  await requireTeethPanel("read");
  return fetchTeethOrderHistoryAudit(options);
}

export async function actionFetchTeethEditContext(
  orderId: string
): Promise<TeethEditContext> {
  await requireTeethPanel("read");
  return fetchTeethOrderEditContext(orderId);
}

export async function actionMarkTeethOrdered(
  orderIds: string[]
): Promise<{ success: boolean; updated: number }> {
  const user = await requireTeethPanel("mutate");
  assertMaxBatchSize(orderIds.length, MAX_BATCH_ORDER_LINES, "pozycji do zamówienia");
  const result = await markTeethOrdered(orderIds, user.id, teethHistoryActor(user));
  revalidatePath("/zeby");
  revalidatePath("/podsumowanie");
  revalidatePath("/kolejka");
  revalidatePath("/moje");
  return { success: true, updated: result.updated };
}

export async function actionMarkTeethPositionsOrdered(
  selections: TeethPositionSelection[]
): Promise<{ success: boolean; updated: number; ordersCompleted: number }> {
  const user = await requireTeethPanel("mutate");
  assertMaxBatchSize(selections.length, MAX_BATCH_ORDER_LINES, "pozycji do zamówienia");
  const result = await markTeethPositionsOrdered(selections, user.id, teethHistoryActor(user));
  revalidatePath("/zeby");
  revalidatePath("/podsumowanie");
  revalidatePath("/kolejka");
  revalidatePath("/moje");
  return { success: true, updated: result.updated, ordersCompleted: result.ordersCompleted };
}

export async function actionUnmarkTeethOrdered(
  orderIds: string[]
): Promise<{ success: boolean; updated: number }> {
  const user = await requireTeethPanel("mutate");
  const result = await unmarkTeethOrdered(orderIds, teethHistoryActor(user));
  revalidatePath("/zeby");
  revalidatePath("/podsumowanie");
  revalidatePath("/kolejka");
  revalidatePath("/moje");
  return { success: true, updated: result.updated };
}

export async function actionFetchTeethScheduleForSupplier(
  supplierId: string
): Promise<TeethSupplierSchedule | null> {
  await requireTeethPanel("read");
  const id = supplierId?.trim();
  if (!id) return null;
  return fetchTeethScheduleForSupplier(id);
}

export async function actionFetchTeethSchedules(): Promise<{
  schedules: TeethSupplierScheduleWithSupplier[];
}> {
  await requireTeethPanel("read");
  const schedules = await fetchTeethSchedules();
  return { schedules };
}

export async function actionFetchAvailableSuppliersForTeethSchedule(): Promise<
  { id: string; name: string }[]
> {
  await requireTeethPanel("read");
  return fetchAvailableSuppliersForTeethSchedule();
}

export async function actionUpsertTeethSchedule(
  supplierId: string,
  orderDayOfWeek: DayOfWeek,
  intervalWeeks: number
): Promise<{ success: boolean }> {
  await requireTeethPanel("mutate");
  const id = supplierId?.trim();
  if (!id) throw new Error("Brak identyfikatora dostawcy");
  await upsertTeethSchedule(id, orderDayOfWeek, intervalWeeks);
  revalidateTeethSupplierPaths();
  return { success: true };
}

export async function actionRemoveTeethSchedule(
  supplierId: string
): Promise<{ success: boolean }> {
  await requireTeethPanel("mutate");
  const id = supplierId?.trim();
  if (!id) throw new Error("Brak identyfikatora dostawcy");
  await removeTeethSchedule(id);
  revalidateTeethSupplierPaths();
  return { success: true };
}

export async function actionShiftTeethSchedule(
  supplierId: string,
  manualDate: string | null
): Promise<{ success: boolean }> {
  const user = await requireTeethPanel("mutate");
  const id = supplierId?.trim();
  if (!id) throw new Error("Brak identyfikatora dostawcy");
  let date: Date | null = null;
  if (manualDate) {
    const parsed = new Date(manualDate);
    if (isNaN(parsed.getTime())) throw new Error("Nieprawidłowy format daty");
    date = parsed;
  }
  await shiftTeethSchedule(id, date, teethHistoryActor(user));
  revalidateTeethSupplierPaths();
  return { success: true };
}

export async function actionMarkTeethScheduleOrdered(
  supplierId: string
): Promise<{ success: boolean }> {
  await requireTeethPanel("mutate");
  const id = supplierId?.trim();
  if (!id) throw new Error("Brak identyfikatora dostawcy");
  await markTeethScheduleOrdered(id, new Date());
  revalidateTeethSupplierPaths();
  return { success: true };
}

export async function actionOverrideTeethDeliveryDate(
  orderIds: string[],
  deliveryDate: string
): Promise<{ success: boolean; updated: number }> {
  const user = await requireTeethPanel("mutate");
  assertMaxBatchSize(orderIds.length, MAX_BATCH_ORDER_LINES, "pozycji do aktualizacji");
  const parsed = new Date(deliveryDate);
  if (isNaN(parsed.getTime())) throw new Error("Nieprawidłowy format daty dostawy");
  const result = await overrideTeethDeliveryDate(
    orderIds,
    deliveryDate,
    teethHistoryActor(user)
  );
  revalidatePath("/zeby");
  revalidatePath("/moje");
  return { success: true, updated: result.updated };
}

export async function actionClearTeethDeliveryDateOverride(
  orderIds: string[]
): Promise<{ success: boolean; updated: number }> {
  const user = await requireTeethPanel("mutate");
  const result = await clearTeethDeliveryDateOverride(orderIds, teethHistoryActor(user));
  revalidatePath("/zeby");
  revalidatePath("/moje");
  return { success: true, updated: result.updated };
}

export async function actionFetchTeethVerificationQueue(): Promise<TeethQueueResult> {
  await requireTeethPanel("read");
  const groups = await fetchTeethVerificationQueue();
  return { groups };
}

export async function actionApproveTeethOcr(
  orderIds: string[],
): Promise<{ success: boolean; updated: number }> {
  await requireTeethPanel("mutate");
  const result = await approveTeethOcr(orderIds);
  revalidatePath("/zeby");
  revalidatePath("/zeby/kolejka");
  revalidatePath("/zeby/weryfikacja");
  revalidatePath("/moje");
  return { success: true, updated: result.updated };
}

export async function actionCountTeethVerificationQueue(): Promise<number> {
  await requireTeethPanel("read");
  return countTeethVerificationQueue();
}

export async function actionGetOcrImageUrl(
  imagePath: string,
): Promise<{ url: string | null }> {
  await requireTeethPanel("read");
  if (!imagePath || !imagePath.startsWith("teeth-ocr/") || imagePath.includes("..")) return { url: null };
  try {
    const { createAdminClient, hasSupabaseConfig } = await import("@/lib/supabase/admin");
    if (!hasSupabaseConfig()) return { url: null };
    const supabase = createAdminClient();
    const { data, error } = await supabase.storage
      .from("teeth-ocr-images")
      .createSignedUrl(imagePath, 3600);
    if (error) {
      console.error("[actionGetOcrImageUrl] Error:", error.message);
      return { url: null };
    }
    return { url: data?.signedUrl ?? null };
  } catch (e) {
    console.error("[actionGetOcrImageUrl] Failed:", e);
    return { url: null };
  }
}

export async function actionUpdateTeethSpecGroup(
  orderId: string,
  spec: { color: string; mould: string | null; jaw: string | null; kind: string },
  newSpec: { color?: string; mould?: string | null; jaw?: string | null; kind?: string },
  newCount?: number,
): Promise<{ success: boolean; error?: string }> {
  await requireTeethPanel("mutate");

  const { createAdminClient, hasSupabaseConfig } = await import("@/lib/supabase/admin");
  if (!hasSupabaseConfig()) return { success: false, error: "Brak konfiguracji Supabase" };
  const supabase = createAdminClient();

  const { data: order, error: orderError } = await supabase
    .from("individual_orders")
    .select("id, is_teeth, teeth_ocr_pending, subiekt_tw_id, products")
    .eq("id", orderId)
    .single();
  if (orderError || !order) return { success: false, error: "Zamówienie nie istnieje" };
  if (!order.is_teeth) return { success: false, error: "To nie jest zamówienie zębowe" };

  const { fetchTeethProductInfo } = await import("@/lib/data/teeth-products");
  const { resolveTeethProductLineForPanelOrder, teethPanelReadinessContextFromMaps } =
    await import("@/lib/teeth/teeth-panel-order-readiness");
  const { validateInlineSpec, validateCount } = await import("@/lib/teeth/teeth-verification-inline");

  const teethProducts = await fetchTeethProductInfo().catch(() => []);
  const ctx = teethPanelReadinessContextFromMaps({
    twIds: new Set(teethProducts.map((row) => row.twId)),
    productLineByTwId: new Map(teethProducts.map((row) => [row.twId, row.productLine])),
    manufacturerByTwId: new Map(teethProducts.map((row) => [row.twId, row.manufacturer])),
    kindByTwId: new Map(teethProducts.map((row) => [row.twId, row.kind])),
  });
  const productLine = resolveTeethProductLineForPanelOrder(order, ctx);
  if (!productLine) return { success: false, error: "Nie udało się ustalić linii produktu" };

  const specValidation = validateInlineSpec(newSpec, productLine);
  if (!specValidation.ok) return { success: false, error: specValidation.error };

  if (newCount !== undefined) {
    const countValidation = validateCount(newCount);
    if (!countValidation.ok) return { success: false, error: countValidation.error };

    let q = supabase
      .from("individual_order_teeth_details")
      .select("id, ordered_at")
      .eq("order_id", orderId)
      .eq("color", spec.color)
      .eq("kind", spec.kind);
    if (spec.mould) q = q.eq("mould", spec.mould);
    else q = q.is("mould", null);
    if (spec.jaw) q = q.eq("jaw", spec.jaw);
    else q = q.is("jaw", null);

    const { data: existing } = await q;
    if (existing?.some((r) => r.ordered_at != null)) {
      return { success: false, error: "Nie można zmienić ilości — pozycje już zamówione" };
    }
  }

  const { updateTeethSpecGroup } = await import("@/lib/data/teeth-order-details");
  try {
    await updateTeethSpecGroup(supabase, orderId, spec, newSpec, newCount);
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Nie udało się zapisać" };
  }

  revalidatePath("/zeby/weryfikacja");
  revalidatePath("/zeby");
  return { success: true };
}

export async function actionAcknowledgeTeethCancellation(
  orderIds: string[]
): Promise<{ success: true; count: number }> {
  await requireTeethPanel("mutate");
  const ids = [...new Set(orderIds.filter(Boolean))];
  if (!ids.length) return { success: true, count: 0 };
  assertMaxBatchSize(ids.length, MAX_BATCH_ORDER_LINES, "pozycji do rozliczenia");

  const { createAdminClient, hasSupabaseConfig } = await import("@/lib/supabase/admin");
  if (!hasSupabaseConfig()) {
    throw new Error("Brak konfiguracji Supabase");
  }
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("individual_orders")
    .select(
      "id, is_teeth, sales_cancelled_at, warehouse_cancel_fulfilled_at, status"
    )
    .in("id", ids);

  if (error) throw new Error(error.message);

  const toAck = (data ?? []).filter(
    (row) =>
      row.is_teeth &&
      row.sales_cancelled_at &&
      !row.warehouse_cancel_fulfilled_at
  );

  if (!toAck.length) {
    throw new Error("Brak pozycji do rozliczenia — pozycje mogą być już rozliczone lub nieanulowane.");
  }

  const now = new Date().toISOString();
  const { error: updErr } = await supabase
    .from("individual_orders")
    .update({ warehouse_cancel_fulfilled_at: now })
    .in("id", toAck.map((r) => r.id))
    .is("warehouse_cancel_fulfilled_at", null);

  if (updErr) throw new Error(updErr.message);

  revalidatePath("/zeby");
  revalidatePath("/zeby/przyjecie");
  revalidatePath("/moje");
  revalidatePath("/podsumowanie");
  revalidatePath("/", "layout");

  return { success: true, count: toAck.length };
}

export async function actionAddTeethSpecGroup(
  orderId: string,
  spec: { color: string; mould: string | null; jaw: string | null; kind: string },
  count: number,
): Promise<{ success: boolean; error?: string }> {
  await requireTeethPanel("mutate");

  const { createAdminClient, hasSupabaseConfig } = await import("@/lib/supabase/admin");
  if (!hasSupabaseConfig()) return { success: false, error: "Brak konfiguracji Supabase" };
  const supabase = createAdminClient();

  const { data: order, error: orderError } = await supabase
    .from("individual_orders")
    .select("id, is_teeth, subiekt_tw_id, products")
    .eq("id", orderId)
    .single();
  if (orderError || !order) return { success: false, error: "Zamówienie nie istnieje" };
  if (!order.is_teeth) return { success: false, error: "To nie jest zamówienie zębowe" };

  const { fetchTeethProductInfo } = await import("@/lib/data/teeth-products");
  const { resolveTeethProductLineForPanelOrder, teethPanelReadinessContextFromMaps } =
    await import("@/lib/teeth/teeth-panel-order-readiness");
  const { validateInlineSpec, validateCount } = await import("@/lib/teeth/teeth-verification-inline");

  const teethProducts = await fetchTeethProductInfo().catch(() => []);
  const ctx = teethPanelReadinessContextFromMaps({
    twIds: new Set(teethProducts.map((row) => row.twId)),
    productLineByTwId: new Map(teethProducts.map((row) => [row.twId, row.productLine])),
    manufacturerByTwId: new Map(teethProducts.map((row) => [row.twId, row.manufacturer])),
    kindByTwId: new Map(teethProducts.map((row) => [row.twId, row.kind])),
  });
  const productLine = resolveTeethProductLineForPanelOrder(order, ctx);
  if (!productLine) return { success: false, error: "Nie udało się ustalić linii produktu" };

  const specValidation = validateInlineSpec(
    { color: spec.color, mould: spec.mould, jaw: spec.jaw, kind: spec.kind },
    productLine,
  );
  if (!specValidation.ok) return { success: false, error: specValidation.error };

  const countValidation = validateCount(count);
  if (!countValidation.ok) return { success: false, error: countValidation.error };

  const { insertTeethSpecGroup } = await import("@/lib/data/teeth-order-details");
  try {
    await insertTeethSpecGroup(supabase, orderId, spec, count);
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Nie udało się dodać pozycji" };
  }

  revalidatePath("/zeby/weryfikacja");
  revalidatePath("/zeby");
  return { success: true };
}

export async function actionExportTeethSupplierCsv(
  supplierId: string,
  format: "batch" | "detailed",
): Promise<{ success: boolean; csv?: string; filename?: string; error?: string }> {
  await requireTeethPanel("read");

  const groups = await fetchTeethQueue();
  const group = groups.find((g) => g.supplierId === supplierId);
  if (!group) return { success: false, error: "Nie znaleziono dostawcy" };

  const { buildTeethSupplierBatchSummary } = await import("@/lib/teeth/teeth-panel-aggregate");
  const { teethBatchSummaryToCsv, teethOrderSpecsToCsv } = await import("@/lib/teeth/teeth-csv-export");
  const { fetchTeethProductInfo } = await import("@/lib/data/teeth-products");
  const { teethPanelReadinessContextFromMaps } = await import("@/lib/teeth/teeth-panel-order-readiness");

  const products = await fetchTeethProductInfo().catch(() => []);
  const ctx = teethPanelReadinessContextFromMaps({
    twIds: new Set(products.map((p) => p.twId)),
    productLineByTwId: new Map(products.map((p) => [p.twId, p.productLine])),
    manufacturerByTwId: new Map(products.map((p) => [p.twId, p.manufacturer])),
    kindByTwId: new Map(products.map((p) => [p.twId, p.kind])),
  });

  const orders = group.items
    .filter((item): item is TeethQueueItem => !isScheduledItem(item))
    .map((item) => ({
      id: item.id,
      products: item.products,
      symbol: item.symbol,
      quantity: item.quantity,
      sales_person_name: item.sales_person_name,
      teeth_details: item.teeth_details,
      subiekt_tw_id: item.subiekt_tw_id,
    }));

  const summary = buildTeethSupplierBatchSummary(orders, ctx);
  const csv = format === "batch"
    ? teethBatchSummaryToCsv(summary)
    : teethOrderSpecsToCsv(summary);

  const dateStr = new Date().toISOString().slice(0, 10);
  const safeName = group.supplierName.replace(/[^a-zA-Z0-9]/g, "_");
  const filename = `zeby_${safeName}_${dateStr}.csv`;

  return { success: true, csv, filename };
}
