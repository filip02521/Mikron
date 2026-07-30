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
import { todayInWarsaw } from "@/lib/time/warsaw";
import type { DayOfWeek, TeethSupplierSchedule, TeethSupplierScheduleWithSupplier } from "@/types/database";
import type { SessionUser } from "@/lib/auth";
import { assertMaxBatchSize, MAX_BATCH_ORDER_LINES } from "@/lib/security/text-limits";

function teethHistoryActor(user: SessionUser) {
  return { id: user.id, email: user.email };
}

function revalidateTeethSupplierPaths() {
  revalidatePath("/zeby");
  revalidatePath("/zakupy/dostawcy");
  revalidatePath("/podsumowanie");
  revalidatePath("/moje");
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

export async function actionAddSupplierToTeethLane(
  supplierId: string
): Promise<{ success: boolean }> {
  await requireTeethPanel("mutate");
  const id = supplierId?.trim();
  if (!id) throw new Error("Brak identyfikatora dostawcy");

  const { createAdminClient, hasSupabaseConfig } = await import("@/lib/supabase/admin");
  if (!hasSupabaseConfig()) return { success: true };

  const supabase = createAdminClient();
  const { error } = await supabase
    .from("teeth_supplier_schedules")
    .upsert(
      {
        supplier_id: id,
        order_day_of_week: 1,
        interval_weeks: 1,
        computed_next_date: null,
        last_order_date: null,
        shift_date: null,
        vacation_note: null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "supplier_id" }
    );

  if (error) throw new Error(error.message);
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

export async function actionDisableTeethSchedule(
  supplierId: string
): Promise<{ success: boolean }> {
  await requireTeethPanel("mutate");
  const id = supplierId?.trim();
  if (!id) throw new Error("Brak identyfikatora dostawcy");

  const { createAdminClient, hasSupabaseConfig } = await import("@/lib/supabase/admin");
  if (!hasSupabaseConfig()) return { success: true };

  const supabase = createAdminClient();
  const { error } = await supabase
    .from("teeth_supplier_schedules")
    .update({
      computed_next_date: null,
      last_order_date: null,
      shift_date: null,
      vacation_note: null,
      updated_at: new Date().toISOString(),
    })
    .eq("supplier_id", id);

  if (error) throw new Error(error.message);
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
  await markTeethScheduleOrdered(id, todayInWarsaw());
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
  const { validateInlineSpec, validateCount, withInferredJawPatch } = await import("@/lib/teeth/teeth-verification-inline");

  const teethProducts = await fetchTeethProductInfo().catch(() => []);
  const ctx = teethPanelReadinessContextFromMaps({
    twIds: new Set(teethProducts.map((row) => row.twId)),
    productLineByTwId: new Map(teethProducts.map((row) => [row.twId, row.productLine])),
    manufacturerByTwId: new Map(teethProducts.map((row) => [row.twId, row.manufacturer])),
    kindByTwId: new Map(teethProducts.map((row) => [row.twId, row.kind])),
  });
  const productLine = resolveTeethProductLineForPanelOrder(order, ctx);
  if (!productLine) return { success: false, error: "Nie udało się ustalić linii produktu" };

  const inferredNewSpec = withInferredJawPatch(
    newSpec,
    productLine,
    {
      mould: spec.mould,
      jaw: (spec.jaw as "upper" | "lower" | null) ?? null,
      kind: (spec.kind as "anterior" | "posterior" | null) ?? null,
    },
  );

  const specValidation = validateInlineSpec(inferredNewSpec, productLine);
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
    await updateTeethSpecGroup(supabase, orderId, spec, inferredNewSpec, newCount);
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
  const { validateInlineSpec, validateCount, withInferredJawPatch } = await import("@/lib/teeth/teeth-verification-inline");

  const teethProducts = await fetchTeethProductInfo().catch(() => []);
  const ctx = teethPanelReadinessContextFromMaps({
    twIds: new Set(teethProducts.map((row) => row.twId)),
    productLineByTwId: new Map(teethProducts.map((row) => [row.twId, row.productLine])),
    manufacturerByTwId: new Map(teethProducts.map((row) => [row.twId, row.manufacturer])),
    kindByTwId: new Map(teethProducts.map((row) => [row.twId, row.kind])),
  });
  const productLine = resolveTeethProductLineForPanelOrder(order, ctx);
  if (!productLine) return { success: false, error: "Nie udało się ustalić linii produktu" };

  const inferredSpec = withInferredJawPatch(
    { color: spec.color, mould: spec.mould, jaw: spec.jaw, kind: spec.kind },
    productLine,
    {
      mould: spec.mould,
      jaw: (spec.jaw as "upper" | "lower" | null) ?? null,
      kind: (spec.kind as "anterior" | "posterior" | null) ?? null,
    },
  );

  const specValidation = validateInlineSpec(inferredSpec, productLine);
  if (!specValidation.ok) return { success: false, error: specValidation.error };

  const countValidation = validateCount(count);
  if (!countValidation.ok) return { success: false, error: countValidation.error };

  const { insertTeethSpecGroup } = await import("@/lib/data/teeth-order-details");
  try {
    await insertTeethSpecGroup(
      supabase,
      orderId,
      {
        color: inferredSpec.color ?? spec.color,
        mould: inferredSpec.mould !== undefined ? inferredSpec.mould : spec.mould,
        jaw:
          inferredSpec.jaw !== undefined
            ? ((inferredSpec.jaw as string | null) ?? null)
            : spec.jaw,
        kind: inferredSpec.kind ?? spec.kind,
      },
      count,
    );
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

const ALLOWED_TEETH_ORDER_FILE_TYPES = [
  "application/xml",
  "text/xml",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-excel",
  "application/pdf",
];

const ALLOWED_TEETH_ORDER_FILE_EXTENSIONS = new Set(["xml", "xlsx", "xls", "pdf"]);

const MAX_TEETH_ORDER_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

function isAllowedTeethOrderFile(file: File): boolean {
  if (ALLOWED_TEETH_ORDER_FILE_TYPES.includes(file.type)) return true;
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  return ALLOWED_TEETH_ORDER_FILE_EXTENSIONS.has(ext);
}

function teethOrderFileContentType(file: File): string {
  if (file.type && ALLOWED_TEETH_ORDER_FILE_TYPES.includes(file.type)) return file.type;
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  switch (ext) {
    case "pdf":
      return "application/pdf";
    case "xlsx":
      return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
    case "xls":
      return "application/vnd.ms-excel";
    case "xml":
      return "application/xml";
    default:
      return file.type || "application/octet-stream";
  }
}

export async function actionUploadTeethOrderFile(
  orderId: string,
  file: File,
): Promise<{ success: boolean; error?: string; fileName?: string }> {
  await requireTeethPanel("mutate");

  if (!file || file.size === 0) {
    return { success: false, error: "Plik jest pusty." };
  }
  if (file.size > MAX_TEETH_ORDER_FILE_SIZE) {
    return { success: false, error: "Plik jest za duży (max 10 MB)." };
  }
  if (!isAllowedTeethOrderFile(file)) {
    return { success: false, error: "Nieobsługiwany typ pliku. Dozwolone: XML, Excel, PDF." };
  }

  const { createAdminClient, hasSupabaseConfig } = await import("@/lib/supabase/admin");
  if (!hasSupabaseConfig()) {
    return { success: false, error: "Brak konfiguracji Storage." };
  }
  const supabase = createAdminClient();

  // Verify the order exists and is a teeth order
  const { data: order, error: orderError } = await supabase
    .from("individual_orders")
    .select("id, is_teeth, status, sales_cancelled_at")
    .eq("id", orderId)
    .single();

  if (orderError || !order) {
    return { success: false, error: "Zamówienie nie istnieje." };
  }
  if (!order.is_teeth) {
    return { success: false, error: "To nie jest zamówienie zębowe." };
  }
  if (order.sales_cancelled_at) {
    return { success: false, error: "Zamówienie zostało anulowane." };
  }
  if (order.status !== "Nowe" && order.status !== "Weryfikacja") {
    return {
      success: false,
      error: "Plik można załączać tylko przed oznaczeniem jako zamówione.",
    };
  }

  // Remove old file if exists
  const { data: existingOrder } = await supabase
    .from("individual_orders")
    .select("teeth_order_file_path")
    .eq("id", orderId)
    .single();

  if (existingOrder?.teeth_order_file_path) {
    await supabase.storage
      .from("teeth-order-files")
      .remove([existingOrder.teeth_order_file_path])
      .catch(() => {});
  }

  // Upload new file
  const { randomUUID } = await import("crypto");
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "bin";
  const storagePath = `teeth-orders/${orderId}/${randomUUID()}.${ext}`;

  const arrayBuffer = await file.arrayBuffer();
  const { error: uploadError } = await supabase.storage
    .from("teeth-order-files")
    .upload(storagePath, arrayBuffer, {
      contentType: teethOrderFileContentType(file),
      upsert: false,
    });

  if (uploadError) {
    console.error("[actionUploadTeethOrderFile] Upload error:", uploadError.message);
    return { success: false, error: "Nie udało się wgrać pliku." };
  }

  // Update order record
  const { error: updateError } = await supabase
    .from("individual_orders")
    .update({
      teeth_order_file_path: storagePath,
      teeth_order_file_name: file.name,
    })
    .eq("id", orderId);

  if (updateError) {
    console.error("[actionUploadTeethOrderFile] DB update error:", updateError.message);
    // Clean up orphaned file
    await supabase.storage.from("teeth-order-files").remove([storagePath]).catch(() => {});
    return { success: false, error: "Nie udało się zapisać informacji o pliku." };
  }

  revalidatePath("/zeby");
  revalidatePath("/kolejka");
  revalidatePath("/moje");

  return { success: true, fileName: file.name };
}

export async function actionRemoveTeethOrderFile(
  orderId: string,
): Promise<{ success: boolean; error?: string }> {
  await requireTeethPanel("mutate");

  const { createAdminClient, hasSupabaseConfig } = await import("@/lib/supabase/admin");
  if (!hasSupabaseConfig()) {
    return { success: false, error: "Brak konfiguracji Storage." };
  }
  const supabase = createAdminClient();

  const { data: order, error: orderError } = await supabase
    .from("individual_orders")
    .select("id, is_teeth, teeth_order_file_path, status")
    .eq("id", orderId)
    .single();

  if (orderError || !order) {
    return { success: false, error: "Zamówienie nie istnieje." };
  }
  if (!order.is_teeth) {
    return { success: false, error: "To nie jest zamówienie zębowe." };
  }
  if (order.status === "Zamowione" || order.status === "Czesciowo_zrealizowane" || order.status === "Zrealizowane") {
    return { success: false, error: "Nie można usunąć pliku z już zamówionej pozycji." };
  }

  if (order.teeth_order_file_path) {
    await supabase.storage
      .from("teeth-order-files")
      .remove([order.teeth_order_file_path])
      .catch(() => {});
  }

  const { error: updateError } = await supabase
    .from("individual_orders")
    .update({
      teeth_order_file_path: null,
      teeth_order_file_name: null,
    })
    .eq("id", orderId);

  if (updateError) {
    return { success: false, error: "Nie udało się zaktualizować zamówienia." };
  }

  revalidatePath("/zeby");
  revalidatePath("/kolejka");
  revalidatePath("/moje");

  return { success: true };
}

export async function actionGetTeethOrderFileUrl(
  orderId: string,
): Promise<{ url: string | null; fileName: string | null }> {
  await requireTeethPanel("read");

  const { createAdminClient, hasSupabaseConfig } = await import("@/lib/supabase/admin");
  if (!hasSupabaseConfig()) return { url: null, fileName: null };
  const supabase = createAdminClient();

  const { data: order, error } = await supabase
    .from("individual_orders")
    .select("teeth_order_file_path, teeth_order_file_name")
    .eq("id", orderId)
    .single();

  if (error || !order?.teeth_order_file_path) {
    return { url: null, fileName: null };
  }

  const { data, error: urlError } = await supabase.storage
    .from("teeth-order-files")
    .createSignedUrl(order.teeth_order_file_path, 3600);

  if (urlError) {
    console.error("[actionGetTeethOrderFileUrl] Error:", urlError.message);
    return { url: null, fileName: order.teeth_order_file_name ?? null };
  }

  return { url: data?.signedUrl ?? null, fileName: order.teeth_order_file_name ?? null };
}

export async function actionGetTeethOrderFileUrlForSales(
  orderId: string,
): Promise<{ url: string | null; fileName: string | null; error?: string }> {
  const { getSessionUser } = await import("@/lib/auth");
  const { isAdmin, isSalesAccount, canManageSalesTeam } = await import("@/lib/auth-roles");
  const { resolveSalesPersonForUser } = await import("@/lib/auth/sales-person");
  const { isProfileActiveDelegateForSalesPerson } = await import(
    "@/lib/data/vacation-delegations"
  );

  const user = await getSessionUser();
  if (!user) {
    return { url: null, fileName: null, error: "Wymagane logowanie." };
  }
  if (!isSalesAccount(user.role) && !canManageSalesTeam(user.role) && !isAdmin(user.role)) {
    return { url: null, fileName: null, error: "Brak uprawnień." };
  }

  const { createAdminClient, hasSupabaseConfig } = await import("@/lib/supabase/admin");
  if (!hasSupabaseConfig()) return { url: null, fileName: null, error: "Brak konfiguracji Storage." };
  const supabase = createAdminClient();

  const { data: order, error } = await supabase
    .from("individual_orders")
    .select("teeth_order_file_path, teeth_order_file_name, is_teeth, sales_person_id")
    .eq("id", orderId)
    .single();

  if (error || !order?.is_teeth || !order?.teeth_order_file_path) {
    return { url: null, fileName: null, error: "Plik zamówienia niedostępny." };
  }

  const orderSalesPersonId =
    typeof order.sales_person_id === "string" ? order.sales_person_id : null;

  let allowed = isAdmin(user.role) || canManageSalesTeam(user.role);
  if (!allowed && orderSalesPersonId) {
    const resolved = await resolveSalesPersonForUser(user);
    if (resolved?.id === orderSalesPersonId) {
      allowed = true;
    } else {
      allowed = await isProfileActiveDelegateForSalesPerson(user.id, orderSalesPersonId);
    }
  }

  if (!allowed) {
    return { url: null, fileName: null, error: "Brak uprawnień do tego pliku." };
  }

  const { data, error: urlError } = await supabase.storage
    .from("teeth-order-files")
    .createSignedUrl(order.teeth_order_file_path, 3600);

  if (urlError) {
    console.error("[actionGetTeethOrderFileUrlForSales] Error:", urlError.message);
    return {
      url: null,
      fileName: order.teeth_order_file_name ?? null,
      error: "Nie udało się przygotować pobierania.",
    };
  }

  return { url: data?.signedUrl ?? null, fileName: order.teeth_order_file_name ?? null };
}
