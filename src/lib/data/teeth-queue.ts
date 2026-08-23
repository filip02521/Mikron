import { createAdminClient, hasSupabaseConfig } from "@/lib/supabase/admin";
import { normalizeIndividualOrders } from "@/lib/data/normalize-order";
import { estimateTeethDeliveryEtaBatch, applyTeethDeliveryEstimateToOrders, collectOrdersNeedingTeethDeliveryEstimate } from "@/lib/data/teeth-delivery-eta";
import { markTeethScheduleOrdered, fetchTeethSchedules } from "@/lib/data/teeth-schedule";
import { todayInWarsaw } from "@/lib/time/warsaw";
import { formatDateString } from "@/lib/orders/dates";
import { assertMaxBatchSize } from "@/lib/security/text-limits";
import { MAX_BATCH_ORDER_LINES } from "@/lib/security/text-limits";
import type { IndividualOrder, IndividualOrderTeethDetail, TeethSupplierScheduleWithSupplier } from "@/types/database";
import { fetchTeethDetailsForOrders } from "@/lib/data/teeth-order-details";
import { fetchTeethProductInfo } from "@/lib/data/teeth-products";
import { enrichTeethDetailsForDisplay } from "@/lib/teeth/teeth-validation";
import type { TeethKind } from "@/lib/teeth/teeth-catalog";
import {
  appendTeethOrderHistory,
  type TeethOrderHistoryActor,
} from "@/lib/data/teeth-order-history";
import {
  analyzeTeethMarkOrdered,
  TEETH_MARK_ORDERED_BLOCKED_MESSAGE,
  TEETH_MARK_ORDERED_FILE_REQUIRED_MESSAGE,
} from "@/lib/teeth/teeth-mark-ordered";
import {
  fetchPendingTeethFileGroupSiblings,
  mergeTeethFileGroupSiblingsIntoOrders,
  copySharedTeethOrderFileOntoUncoveredSiblings,
} from "@/lib/data/teeth-order-file-group";
import { teethPanelReadinessContextFromMaps } from "@/lib/teeth/teeth-panel-order-readiness";
import { resolveSupplierForTeethManufacturer } from "@/lib/orders/teeth-ocr-prosba-prefill";
import { fetchSuppliersForForm } from "@/lib/data/queries";
import {
  TEETH_HISTORY_PAGE_SIZE,
  TEETH_QUEUE_PENDING_STATUSES,
  groupTeethItemsBySupplier,
  isScheduledItem,
  type TeethPositionSelection,
  type TeethQueueGroup,
  type TeethQueueItem,
  type TeethScheduledItem,
  type TeethSupplierDeliveryEta,
} from "@/lib/data/teeth-queue-shared";

export { fetchTeethDetailsForOrders } from "@/lib/data/teeth-order-details";

export {
  TEETH_HISTORY_PAGE_SIZE,
  TEETH_QUEUE_PENDING_STATUSES,
  groupTeethItemsBySupplier,
  isScheduledItem,
  type TeethPositionSelection,
  type TeethQueueEntry,
  type TeethQueueGroup,
  type TeethQueueItem,
  type TeethScheduledItem,
  type TeethSupplierDeliveryEta,
} from "@/lib/data/teeth-queue-shared";

export type TeethHistoryFetchOptions = {
  supplierId?: string | null;
  salesPersonId?: string | null;
  limit?: number;
  offset?: number;
};

export type TeethHistoryPage = {
  items: TeethQueueItem[];
  hasMore: boolean;
};

function mapQueueItems(orders: IndividualOrder[]): TeethQueueItem[] {
  return orders.map((order) => ({
    ...order,
    supplier_name: order.supplier?.name ?? null,
    sales_person_name: order.sales_person?.name ?? null,
  }));
}

export async function attachTeethDetailsToIndividualOrders(orders: IndividualOrder[]) {
  const orderIds = orders.map((o) => o.id);
  if (!orderIds.length) return orders.map((o) => ({ ...o, teeth_details: null as IndividualOrderTeethDetail[] | null }));

  const [teethDetailsMap, teethProducts] = await Promise.all([
    fetchTeethDetailsForOrders(orderIds),
    fetchTeethProductInfo().catch(() => []),
  ]);
  const kindByTwId = new Map<number, TeethKind | null>(
    teethProducts.map((row) => [row.twId, row.kind])
  );

  return orders.map((order) => {
    const twId =
      order.subiekt_tw_id != null && order.subiekt_tw_id > 0
        ? Math.trunc(order.subiekt_tw_id)
        : null;
    const adminKind = twId != null ? (kindByTwId.get(twId) ?? null) : null;
    return {
      ...order,
      teeth_details: enrichTeethDetailsForDisplay(
        teethDetailsMap.get(order.id) ?? null,
        adminKind
      ),
    };
  });
}

function scheduledItemFromSchedule(sched: {
  supplier_id: string;
  supplier_name: string;
  computed_next_date: string | null;
  shift_date: string | null;
  vacation_note: string | null;
}): TeethScheduledItem {
  return {
    id: `sched:${sched.supplier_id}`,
    supplier_id: sched.supplier_id,
    supplier_name: sched.supplier_name,
    computed_next_date: sched.computed_next_date,
    shift_date: sched.shift_date,
    vacation_note: sched.vacation_note,
    is_scheduled: true,
  };
}

async function enrichTeethGroupsWithDeliveryEta(
  groups: TeethQueueGroup[]
): Promise<TeethQueueGroup[]> {
  const placementAt = new Date().toISOString();
  const supplierIds = [
    ...new Set(groups.map((g) => g.supplierId).filter((id): id is string => Boolean(id))),
  ];

  const etaMap = new Map<string, TeethSupplierDeliveryEta>();
  if (supplierIds.length > 0) {
    try {
      const batchResult = await estimateTeethDeliveryEtaBatch(supplierIds, placementAt);
      for (const [supplierId, estimate] of batchResult) {
        etaMap.set(supplierId, {
          expectedDate: formatDateString(estimate.expectedDate),
          avgBusinessDays: estimate.avgBusinessDays,
          sampleCount: estimate.sampleCount,
          lowConfidence: estimate.lowConfidence ?? false,
          source: estimate.source,
        });
      }
    } catch {
      // ETA opcjonalne
    }
  }

  return groups.map((group) => ({
    ...group,
    deliveryEta: group.supplierId ? (etaMap.get(group.supplierId) ?? null) : null,
  }));
}

/** Pobierz pozycje zębów oczekujące na zamówienie + zaplanowanych dostawców. */
export async function fetchTeethQueue(): Promise<TeethQueueGroup[]> {
  if (!hasSupabaseConfig()) return [];

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("individual_orders")
    .select("*, supplier:suppliers(*), sales_person:sales_people(*)")
    .eq("is_teeth", true)
    .eq("teeth_ocr_pending", false)
    .in("status", [...TEETH_QUEUE_PENDING_STATUSES])
    .is("sales_cancelled_at", null)
    .order("teeth_queue_entered_at", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: true })
    .limit(500);

  if (error) throw new Error(error.message);

  const orders = normalizeIndividualOrders(data ?? []);
  const ordersWithTeeth = await attachTeethDetailsToIndividualOrders(orders);
  const items = mapQueueItems(ordersWithTeeth);

  // Pobierz zaplanowanych dostawców z harmonogramu (computed_next_date <= today)
  const todayStr = formatDateString(todayInWarsaw());
  const schedules = await fetchTeethSchedules().catch(() => []);
  const dueSchedules = schedules.filter(
    (s) => s.computed_next_date && s.computed_next_date <= todayStr
  );

  const groupsMap = new Map<string, TeethQueueGroup>();
  for (const item of items) {
    const key = item.supplier_id ?? "__no_supplier";
    const existing = groupsMap.get(key);
    if (existing) {
      existing.items.push(item);
    } else {
      groupsMap.set(key, {
        supplierId: item.supplier_id,
        supplierName: item.supplier_name ?? "Bez dostawcy",
        items: [item],
        scheduledOnly: false,
      });
    }
  }

  // Połącz harmonogram z grupami dostawców (także gdy są już prośby handlowców)
  for (const sched of dueSchedules) {
    const key = sched.supplier_id;
    const schedItem = scheduledItemFromSchedule(sched);
    const existing = groupsMap.get(key);
    if (existing) {
      existing.dueSchedule = schedItem;
      const hasSchedRow = existing.items.some((item) => isScheduledItem(item));
      if (!hasSchedRow) {
        existing.items.unshift(schedItem);
      }
    } else {
      groupsMap.set(key, {
        supplierId: sched.supplier_id,
        supplierName: sched.supplier_name,
        items: [schedItem],
        scheduledOnly: true,
        dueSchedule: schedItem,
      });
    }
  }

  const sorted = Array.from(groupsMap.values()).sort((a, b) =>
    a.supplierName.localeCompare(b.supplierName, "pl")
  );
  return enrichTeethGroupsWithDeliveryEta(sorted  );
}

/** Historia zamówień zębów pogrupowana wg dostawcy. */
export async function fetchTeethHistoryGroups(
  options?: TeethHistoryFetchOptions
): Promise<TeethQueueGroup[]> {
  const page = await fetchTeethHistoryPage(options);
  return groupTeethItemsBySupplier(page.items);
}

/** Pobierz historię zamówień zębów (status Zamowione lub nowszy) z paginacją. */
export async function fetchTeethHistoryPage(
  options?: TeethHistoryFetchOptions
): Promise<TeethHistoryPage> {
  if (!hasSupabaseConfig()) return { items: [], hasMore: false };

  const supabase = createAdminClient();
  const limit = Math.min(Math.max(options?.limit ?? TEETH_HISTORY_PAGE_SIZE, 1), 200);
  const offset = Math.max(options?.offset ?? 0, 0);

  let query = supabase
    .from("individual_orders")
    .select("*, supplier:suppliers(*), sales_person:sales_people(*)")
    .eq("is_teeth", true)
    .in("status", ["Zamowione", "Czesciowo_zrealizowane", "Zrealizowane", "Anulowane"])
    .order("teeth_ordered_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (options?.supplierId) {
    query = query.eq("supplier_id", options.supplierId);
  }
  if (options?.salesPersonId) {
    query = query.eq("sales_person_id", options.salesPersonId);
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);

  const orders = normalizeIndividualOrders(data ?? []);
  const ordersWithTeeth = await attachTeethDetailsToIndividualOrders(orders);
  const items = mapQueueItems(ordersWithTeeth);
  return {
    items,
    hasMore: items.length >= limit,
  };
}

type SupabaseAdminClient = ReturnType<typeof createAdminClient>;

type BeforeUpdateRow = { id: string; supplier_id: string | null; teeth_delivery_date: string | null };

async function postMarkOrderedCleanup(
  supabase: SupabaseAdminClient,
  updatedIds: string[],
  beforeUpdate: BeforeUpdateRow[] | null,
  now: string,
  userId: string,
  actor?: TeethOrderHistoryActor
): Promise<void> {
  if (updatedIds.length === 0) return;

  const updatedSet = new Set(updatedIds);
  const markedRows = (beforeUpdate ?? []).filter((row) => updatedSet.has(row.id));

  const supplierIds = new Set<string>();
  for (const row of markedRows) {
    if (row.supplier_id) supplierIds.add(row.supplier_id);
  }

  const ordersNeedingDeliveryDate = collectOrdersNeedingTeethDeliveryEstimate(
    markedRows,
    now
  );

  try {
    await applyTeethDeliveryEstimateToOrders(
      supabase,
      ordersNeedingDeliveryDate,
      now
    );
  } catch {
    // ETA opcjonalne — błąd nie przerywa oznaczania
  }

  const today = todayInWarsaw();
  const historyActor: TeethOrderHistoryActor = {
    id: actor?.id ?? userId,
    email: actor?.email ?? null,
  };
  const ordersBySupplier = new Map<string, string[]>();
  for (const row of markedRows) {
    const supplierId = row.supplier_id as string | null;
    const orderId = row.id as string;
    if (!supplierId) continue;
    const list = ordersBySupplier.get(supplierId) ?? [];
    list.push(orderId);
    ordersBySupplier.set(supplierId, list);
  }

  for (const supplierId of supplierIds) {
    try {
      const advanced = await markTeethScheduleOrdered(supplierId, today);
      if (advanced) {
        await appendTeethOrderHistory({
          action: "schedule_ordered",
          actor: historyActor,
          supplierId,
          orderIds: ordersBySupplier.get(supplierId) ?? [],
        });
      }
    } catch {
      // Harmonogram opcjonalny — błąd nie przerywa
    }
  }

  for (const [supplierId, ids] of ordersBySupplier) {
    await appendTeethOrderHistory({
      action: "ordered",
      actor: historyActor,
      supplierId,
      orderIds: ids,
      meta: { batchSize: ids.length },
    });
  }
}

/** Oznacz pozycje zębów jako zamówione — tylko z kompletną listą, status Nowe. */
export async function markTeethOrdered(
  orderIds: string[],
  userId: string,
  actor?: TeethOrderHistoryActor
): Promise<{ updated: number }> {
  const uniqueIds = [...new Set(orderIds)].filter(Boolean);
  if (!uniqueIds.length) return { updated: 0 };

  const supabase = createAdminClient();
  const now = new Date().toISOString();

  const { error: normalizeErr } = await supabase
    .from("individual_orders")
    .update({ status: "Nowe" })
    .in("id", uniqueIds)
    .eq("is_teeth", true)
    .eq("status", "Weryfikacja")
    .is("sales_cancelled_at", null);

  if (normalizeErr) throw new Error(normalizeErr.message);

  const { data: rawOrders, error: fetchErr } = await supabase
    .from("individual_orders")
    .select("*, supplier:suppliers(*), sales_person:sales_people(*)")
    .in("id", uniqueIds)
    .eq("is_teeth", true)
    .in("status", [...TEETH_QUEUE_PENDING_STATUSES])
    .is("sales_cancelled_at", null);

  if (fetchErr) throw new Error(fetchErr.message);

  const orders = await attachTeethDetailsToIndividualOrders(
    normalizeIndividualOrders(rawOrders ?? [])
  );
  const teethProducts = await fetchTeethProductInfo().catch(() => []);
  const readinessCtx = teethPanelReadinessContextFromMaps({
    twIds: new Set(teethProducts.map((row) => row.twId)),
    productLineByTwId: new Map(teethProducts.map((row) => [row.twId, row.productLine])),
    manufacturerByTwId: new Map(teethProducts.map((row) => [row.twId, row.manufacturer])),
    kindByTwId: new Map(teethProducts.map((row) => [row.twId, row.kind])),
  });
  const ordersById = new Map(orders.map((order) => [order.id, order]));
  mergeTeethFileGroupSiblingsIntoOrders(
    ordersById,
    await fetchPendingTeethFileGroupSiblings(
      supabase,
      orders.map((order) => order.supplier_id)
    )
  );
  const analysis = analyzeTeethMarkOrdered(uniqueIds, ordersById, readinessCtx);
  const idsToMark = analysis.withSpecIds;

  if (!idsToMark.length) {
    if (analysis.hasMissingFile && analysis.hasMissingSpec) {
      throw new Error(
        `${TEETH_MARK_ORDERED_BLOCKED_MESSAGE} Dodatkowo brakuje pliku zamówienia.`
      );
    }
    if (analysis.hasMissingFile) {
      throw new Error(TEETH_MARK_ORDERED_FILE_REQUIRED_MESSAGE);
    }
    throw new Error(TEETH_MARK_ORDERED_BLOCKED_MESSAGE);
  }

  await copySharedTeethOrderFileOntoUncoveredSiblings(supabase, ordersById);

  // Auto-przypisz dostawcę PRZED snapshotem do ETA — inaczej postMarkOrderedCleanup
  // pomija zamówienia bez supplier_id i nie zapisuje teeth_delivery_date.
  const ordersWithoutSupplier = (orders ?? []).filter(
    (o) => idsToMark.includes(o.id) && !o.supplier_id
  );
  if (ordersWithoutSupplier.length > 0) {
    const suppliers = await fetchSuppliersForForm().catch(() => [] as Array<{ id: string; name: string }>);
    const manufacturerByTwId = new Map(teethProducts.map((row) => [row.twId, row.manufacturer]));
    for (const order of ordersWithoutSupplier) {
      const twId = order.subiekt_tw_id != null && order.subiekt_tw_id > 0
        ? Math.trunc(order.subiekt_tw_id)
        : null;
      if (!twId) continue;
      const manufacturer = manufacturerByTwId.get(twId);
      if (!manufacturer) continue;
      const resolvedSupplierId = resolveSupplierForTeethManufacturer(manufacturer, suppliers);
      if (resolvedSupplierId) {
        await supabase
          .from("individual_orders")
          .update({ supplier_id: resolvedSupplierId })
          .eq("id", order.id);
        order.supplier_id = resolvedSupplierId;
      }
    }
  }

  const { data: beforeUpdate } = await supabase
    .from("individual_orders")
    .select("id, supplier_id, teeth_delivery_date")
    .in("id", idsToMark)
    .eq("is_teeth", true)
    .in("status", [...TEETH_QUEUE_PENDING_STATUSES])
    .is("sales_cancelled_at", null);

  const { data, error } = await supabase
    .from("individual_orders")
    .update({
      status: "Zamowione",
      ordered_at: now,
      teeth_ordered_by: userId,
      teeth_ordered_at: now,
    })
    .in("id", idsToMark)
    .eq("is_teeth", true)
    .in("status", [...TEETH_QUEUE_PENDING_STATUSES])
    .is("sales_cancelled_at", null)
    .select("id");

  if (error) throw new Error(error.message);

  const updatedIds = (data ?? []).map((r) => r.id as string);
  if (updatedIds.length === 0) return { updated: 0 };

  await postMarkOrderedCleanup(supabase, updatedIds, beforeUpdate, now, userId, actor);

  return { updated: updatedIds.length };
}

/** Oznacz poszczególne pozycje zębów jako zamówione (per-position ordering). */
export async function markTeethPositionsOrdered(
  selections: TeethPositionSelection[],
  userId: string,
  actor?: TeethOrderHistoryActor
): Promise<{ updated: number; ordersCompleted: number }> {
  const filtered = selections.filter((s) => s.positions.length > 0);
  if (filtered.length === 0) return { updated: 0, ordersCompleted: 0 };

  const supabase = createAdminClient();
  const now = new Date().toISOString();

  const allOrderIds = [...new Set(filtered.map((s) => s.orderId))];

  // Pobierz zamówienia z teeth_details, żeby sprawdzić kompletność specyfikacji
  const { data: rawOrders, error: fetchErr } = await supabase
    .from("individual_orders")
    .select("*, supplier:suppliers(*), sales_person:sales_people(*)")
    .in("id", allOrderIds)
    .eq("is_teeth", true)
    .in("status", [...TEETH_QUEUE_PENDING_STATUSES])
    .is("sales_cancelled_at", null);

  if (fetchErr) throw new Error(fetchErr.message);

  const orders = await attachTeethDetailsToIndividualOrders(
    normalizeIndividualOrders(rawOrders ?? [])
  );
  const ordersById = new Map(orders.map((order) => [order.id, order]));
  mergeTeethFileGroupSiblingsIntoOrders(
    ordersById,
    await fetchPendingTeethFileGroupSiblings(
      supabase,
      orders.map((order) => order.supplier_id)
    )
  );

  const teethProducts = await fetchTeethProductInfo().catch(() => []);
  const readinessCtx = teethPanelReadinessContextFromMaps({
    twIds: new Set(teethProducts.map((row) => row.twId)),
    productLineByTwId: new Map(teethProducts.map((row) => [row.twId, row.productLine])),
    manufacturerByTwId: new Map(teethProducts.map((row) => [row.twId, row.manufacturer])),
    kindByTwId: new Map(teethProducts.map((row) => [row.twId, row.kind])),
  });

  // Filtruj pozycje z kompletną specyfikacją; plik = jeden na grupę dostawcy.
  const analysis = analyzeTeethMarkOrdered(allOrderIds, ordersById, readinessCtx);
  const readyIds = new Set(analysis.withSpecIds);
  const validSelections: TeethPositionSelection[] = [];
  const blockedByFile = analysis.hasMissingFile;
  const blockedBySpec = analysis.hasMissingSpec;

  for (const sel of filtered) {
    if (!readyIds.has(sel.orderId)) continue;
    const order = ordersById.get(sel.orderId);
    if (!order) continue;
    const details = order.teeth_details ?? [];
    const positionsToMark = sel.positions.filter((pos) => {
      const detail = details.find((d) => d.position === pos);
      return detail && !detail.ordered_at;
    });
    if (positionsToMark.length > 0) {
      validSelections.push({ orderId: sel.orderId, positions: positionsToMark });
    }
  }

  if (validSelections.length === 0) {
    if (blockedByFile && blockedBySpec) {
      throw new Error(
        `${TEETH_MARK_ORDERED_BLOCKED_MESSAGE} Dodatkowo brakuje pliku zamówienia.`
      );
    }
    throw new Error(
      blockedByFile
        ? TEETH_MARK_ORDERED_FILE_REQUIRED_MESSAGE
        : TEETH_MARK_ORDERED_BLOCKED_MESSAGE
    );
  }

  await copySharedTeethOrderFileOntoUncoveredSiblings(supabase, ordersById);

  // Oznacz poszczególne pozycje w individual_order_teeth_details
  let updatedCount = 0;
  for (const sel of validSelections) {
    const { data: updatedRows, error: detailErr } = await supabase
      .from("individual_order_teeth_details")
      .update({ ordered_at: now })
      .eq("order_id", sel.orderId)
      .in("position", sel.positions)
      .is("ordered_at", null)
      .select("id");

    if (detailErr) throw new Error(detailErr.message);
    updatedCount += (updatedRows ?? []).length;
  }

  // Sprawdź które zamówienia mają wszystkie pozycje zamówione — batch select
  const completedCheckIds = validSelections
    .map((sel) => {
      const order = ordersById.get(sel.orderId);
      if (!order || (order.teeth_details ?? []).length === 0) return null;
      return sel.orderId;
    })
    .filter((id): id is string => id !== null);

  const ordersCompleted: string[] = [];
  if (completedCheckIds.length > 0) {
    const { data: allDetails, error: detailsErr } = await supabase
      .from("individual_order_teeth_details")
      .select("order_id, ordered_at")
      .in("order_id", completedCheckIds);

    if (detailsErr) throw new Error(detailsErr.message);

    const byOrder = new Map<string, { total: number; ordered: number }>();
    for (const row of allDetails ?? []) {
      const oid = String(row.order_id);
      const entry = byOrder.get(oid) ?? { total: 0, ordered: 0 };
      entry.total += 1;
      if (row.ordered_at != null) entry.ordered += 1;
      byOrder.set(oid, entry);
    }

    for (const [oid, counts] of byOrder) {
      if (counts.total > 0 && counts.ordered === counts.total) {
        ordersCompleted.push(oid);
      }
    }
  }

  // Flipuj status zamówień które są w pełni zamówione
  if (ordersCompleted.length > 0) {
    // Auto-przypisz dostawcę PRZED snapshotem do ETA (jak w markTeethOrdered).
    const completedOrdersWithoutSupplier = (orders ?? []).filter(
      (o) => ordersCompleted.includes(o.id) && !o.supplier_id
    );
    if (completedOrdersWithoutSupplier.length > 0) {
      const suppliers = await fetchSuppliersForForm().catch(() => [] as Array<{ id: string; name: string }>);
      const manufacturerByTwId = new Map(teethProducts.map((row) => [row.twId, row.manufacturer]));
      for (const order of completedOrdersWithoutSupplier) {
        const twId = order.subiekt_tw_id != null && order.subiekt_tw_id > 0
          ? Math.trunc(order.subiekt_tw_id)
          : null;
        if (!twId) continue;
        const manufacturer = manufacturerByTwId.get(twId);
        if (!manufacturer) continue;
        const resolvedSupplierId = resolveSupplierForTeethManufacturer(manufacturer, suppliers);
        if (resolvedSupplierId) {
          await supabase
            .from("individual_orders")
            .update({ supplier_id: resolvedSupplierId })
            .eq("id", order.id);
          order.supplier_id = resolvedSupplierId;
        }
      }
    }

    const { data: beforeUpdate } = await supabase
      .from("individual_orders")
      .select("id, supplier_id, teeth_delivery_date")
      .in("id", ordersCompleted)
      .eq("is_teeth", true)
      .in("status", [...TEETH_QUEUE_PENDING_STATUSES])
      .is("sales_cancelled_at", null);

    const { error: orderErr } = await supabase
      .from("individual_orders")
      .update({
        status: "Zamowione",
        ordered_at: now,
        teeth_ordered_by: userId,
        teeth_ordered_at: now,
      })
      .in("id", ordersCompleted)
      .eq("is_teeth", true)
      .in("status", [...TEETH_QUEUE_PENDING_STATUSES])
      .is("sales_cancelled_at", null);

    if (orderErr) throw new Error(orderErr.message);

    await postMarkOrderedCleanup(supabase, ordersCompleted, beforeUpdate, now, userId, actor);
  }

  return { updated: updatedCount, ordersCompleted: ordersCompleted.length };
}

/** Cofnij oznaczenie zębów jako zamówione. */
export async function unmarkTeethOrdered(
  orderIds: string[],
  actor?: TeethOrderHistoryActor
): Promise<{ updated: number }> {
  if (!orderIds.length) return { updated: 0 };

  const supabase = createAdminClient();

  const { data: beforeRows } = await supabase
    .from("individual_orders")
    .select("id, supplier_id")
    .in("id", orderIds)
    .eq("is_teeth", true)
    .eq("status", "Zamowione");

  const { data, error } = await supabase
    .from("individual_orders")
    .update({
      status: "Nowe",
      ordered_at: null,
      teeth_ordered_by: null,
      teeth_ordered_at: null,
      teeth_delivery_date: null,
    })
    .in("id", orderIds)
    .eq("is_teeth", true)
    .eq("status", "Zamowione")
    .select("id");

  if (error) throw new Error(error.message);

  const updatedIds = new Set((data ?? []).map((r) => String(r.id)));
  if (updatedIds.size > 0) {
    // Wyczyść ordered_at na poszczególnych pozycjach zębów
    await supabase
      .from("individual_order_teeth_details")
      .update({ ordered_at: null })
      .in("order_id", Array.from(updatedIds))
      .not("ordered_at", "is", null);

    const bySupplier = new Map<string, string[]>();
    for (const row of beforeRows ?? []) {
      if (!updatedIds.has(String(row.id))) continue;
      const supplierId = row.supplier_id != null ? String(row.supplier_id) : null;
      const key = supplierId ?? "__none";
      const list = bySupplier.get(key) ?? [];
      list.push(String(row.id));
      bySupplier.set(key, list);
    }
    for (const [key, ids] of bySupplier) {
      await appendTeethOrderHistory({
        action: "unmark",
        actor,
        supplierId: key === "__none" ? null : key,
        orderIds: ids,
      });
    }
  }

  return { updated: data?.length ?? 0 };
}

/** Ręczne nadpisanie planowanej daty dostawy dla zamówień zębowych. */
export async function overrideTeethDeliveryDate(
  orderIds: string[],
  deliveryDate: string,
  actor?: TeethOrderHistoryActor
): Promise<{ updated: number }> {
  if (!orderIds.length) return { updated: 0 };

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("individual_orders")
    .update({ teeth_delivery_date: deliveryDate })
    .in("id", orderIds)
    .eq("is_teeth", true)
    .in("status", ["Nowe", "Zamowione", "Czesciowo_zrealizowane"])
    .select("id");

  if (error) throw new Error(error.message);
  const updated = data?.length ?? 0;
  if (updated > 0) {
    await appendTeethOrderHistory({
      action: "delivery_override",
      actor,
      orderIds: (data ?? []).map((r) => String(r.id)),
      meta: { deliveryDate },
    });
  }
  return { updated };
}

/** Wyczyść ręcznie nadpisaną datę dostawy (powrót do automatycznego szacunku). */
export async function clearTeethDeliveryDateOverride(
  orderIds: string[],
  actor?: TeethOrderHistoryActor
): Promise<{ updated: number }> {
  if (!orderIds.length) return { updated: 0 };

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("individual_orders")
    .update({ teeth_delivery_date: null })
    .in("id", orderIds)
    .eq("is_teeth", true)
    .in("status", ["Nowe", "Zamowione", "Czesciowo_zrealizowane"])
    .select("id, supplier_id, teeth_ordered_at, ordered_at");

  if (error) throw new Error(error.message);
  const rows = (data ?? []) as Array<{
    id: string;
    supplier_id: string | null;
    teeth_ordered_at: string | null;
    ordered_at: string | null;
  }>;
  const updated = rows.length;
  if (updated > 0) {
    await appendTeethOrderHistory({
      action: "delivery_clear",
      actor,
      orderIds: rows.map((r) => String(r.id)),
    });
    try {
      await applyTeethDeliveryEstimateToOrders(
        supabase,
        rows,
        new Date().toISOString()
      );
    } catch {
      // ETA opcjonalne
    }
  }
  return { updated };
}

/** Policz pozycje zębów oczekujące na zamówienie — do badge w nawigacji. */
export async function countTeethQueue(): Promise<number> {
  if (!hasSupabaseConfig()) return 0;

  const supabase = createAdminClient();
  const { count, error } = await supabase
    .from("individual_orders")
    .select("*", { count: "exact", head: true })
    .eq("is_teeth", true)
    .eq("teeth_ocr_pending", false)
    .in("status", [...TEETH_QUEUE_PENDING_STATUSES])
    .is("sales_cancelled_at", null);

  if (error) return 0;

  // Dodaj zaplanowanych dostawców z computed_next_date <= today
  const todayStr = formatDateString(todayInWarsaw());
  const schedules = await fetchTeethSchedules().catch(() => []);
  const dueCount = schedules.filter(
    (s) => s.computed_next_date && s.computed_next_date <= todayStr
  ).length;

  return (count ?? 0) + dueCount;
}

/** Wersja kolejki zębów do polling — count + max(created_at) dla detekcji zmian. */
export async function fetchTeethQueueVersion(): Promise<string | null> {
  if (!hasSupabaseConfig()) return null;

  const supabase = createAdminClient();
  const todayStr = formatDateString(todayInWarsaw());

  const [ordersResult, schedulesResult] = await Promise.all([
    supabase
      .from("individual_orders")
      .select("id, created_at", { count: "exact" })
      .eq("is_teeth", true)
      .eq("teeth_ocr_pending", false)
      .in("status", [...TEETH_QUEUE_PENDING_STATUSES])
      .is("sales_cancelled_at", null)
      .order("created_at", { ascending: false }),
    fetchTeethSchedules().catch(() => [] as TeethSupplierScheduleWithSupplier[]),
  ]);

  if (ordersResult.error) return null;

  const orderRows = ordersResult.data ?? [];
  const orderCount = ordersResult.count ?? 0;
  const maxCreatedAt = orderRows[0]?.created_at ?? null;
  const orderIds = orderRows.map((row) => row.id);

  const dueSchedules = (schedulesResult as TeethSupplierScheduleWithSupplier[]).filter(
    (s) => s.computed_next_date && s.computed_next_date <= todayStr
  );
  const maxSchedUpdated = dueSchedules
    .map((s) => s.updated_at)
    .sort()
    .pop() ?? "";
  const dueCount = dueSchedules.length;
  const count = orderCount + dueCount;

  let teethDetailsVersion = "";
  if (orderIds.length > 0) {
    const { count: teethDetailCount, data: latestTeeth, error: teethErr } = await supabase
      .from("individual_order_teeth_details")
      .select("created_at", { count: "exact" })
      .in("order_id", orderIds)
      .order("created_at", { ascending: false })
      .limit(1);

    if (!teethErr) {
      teethDetailsVersion = `${teethDetailCount ?? 0}:${latestTeeth?.[0]?.created_at ?? ""}`;
    }
  }

  return `${count}:${maxCreatedAt ?? ""}:${maxSchedUpdated}:${teethDetailsVersion}`;
}

/** Pobierz pozycje zębów oczekujące na weryfikację OCR. */
export async function fetchTeethVerificationQueue(): Promise<TeethQueueGroup[]> {
  if (!hasSupabaseConfig()) return [];

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("individual_orders")
    .select("*, supplier:suppliers(*), sales_person:sales_people(*)")
    .eq("is_teeth", true)
    .eq("teeth_ocr_pending", true)
    .in("status", [...TEETH_QUEUE_PENDING_STATUSES])
    .is("sales_cancelled_at", null)
    .order("created_at", { ascending: true })
    .limit(200);

  if (error) throw new Error(error.message);

  const orders = normalizeIndividualOrders(data ?? []);
  const ordersWithTeeth = await attachTeethDetailsToIndividualOrders(orders);
  const items = mapQueueItems(ordersWithTeeth);

  const groupsMap = new Map<string, TeethQueueGroup>();
  for (const item of items) {
    const key = item.supplier_id ?? "__no_supplier";
    const existing = groupsMap.get(key);
    if (existing) {
      existing.items.push(item);
    } else {
      groupsMap.set(key, {
        supplierId: item.supplier_id,
        supplierName: item.supplier_name ?? "Bez dostawcy",
        items: [item],
        scheduledOnly: false,
      });
    }
  }

  return Array.from(groupsMap.values()).sort((a, b) =>
    a.supplierName.localeCompare(b.supplierName, "pl"),
  );
}

/** Policz pozycje zębów oczekujące na weryfikację OCR — do badge w tabs. */
export async function countTeethVerificationQueue(): Promise<number> {
  if (!hasSupabaseConfig()) return 0;

  const supabase = createAdminClient();
  const { count, error } = await supabase
    .from("individual_orders")
    .select("*", { count: "exact", head: true })
    .eq("is_teeth", true)
    .eq("teeth_ocr_pending", true)
    .in("status", [...TEETH_QUEUE_PENDING_STATUSES])
    .is("sales_cancelled_at", null);

  if (error) return 0;
  return count ?? 0;
}

/** Zatwierdź pozycje OCR — usuń flagę pending i ustaw status na "Nowe". */
export async function approveTeethOcr(orderIds: string[]): Promise<{ updated: number }> {
  if (!hasSupabaseConfig()) return { updated: 0 };
  if (orderIds.length === 0) return { updated: 0 };
  assertMaxBatchSize(orderIds.length, MAX_BATCH_ORDER_LINES, "pozycji do zatwierdzenia");

  const supabase = createAdminClient();

  // Pobierz ścieżki zdjęć przed aktualizacją, żeby móc je usunąć po zatwierdzeniu.
  const { data: beforeRows } = await supabase
    .from("individual_orders")
    .select("id, teeth_ocr_image_path, subiekt_tw_id, supplier_id")
    .in("id", orderIds)
    .eq("is_teeth", true)
    .eq("teeth_ocr_pending", true)
    .is("sales_cancelled_at", null);

  // Auto-przypisz dostawcę dla zębów bez supplier_id na podstawie producenta
  const teethProducts = await fetchTeethProductInfo().catch(() => []);
  const manufacturerByTwId = new Map(teethProducts.map((row) => [row.twId, row.manufacturer]));
  const ordersWithoutSupplier = (beforeRows ?? []).filter((r) => !r.supplier_id);
  if (ordersWithoutSupplier.length > 0) {
    const suppliers = await fetchSuppliersForForm().catch(() => [] as Array<{ id: string; name: string }>);
    for (const row of ordersWithoutSupplier) {
      const twId = row.subiekt_tw_id != null && row.subiekt_tw_id > 0
        ? Math.trunc(row.subiekt_tw_id)
        : null;
      if (!twId) continue;
      const manufacturer = manufacturerByTwId.get(twId);
      if (!manufacturer) continue;
      const resolvedSupplierId = resolveSupplierForTeethManufacturer(manufacturer, suppliers);
      if (resolvedSupplierId) {
        await supabase
          .from("individual_orders")
          .update({ supplier_id: resolvedSupplierId })
          .eq("id", row.id);
      }
    }
  }

  const { data, error } = await supabase
    .from("individual_orders")
    .update({
      teeth_ocr_pending: false,
      status: "Nowe",
      teeth_queue_entered_at: new Date().toISOString(),
    })
    .in("id", orderIds)
    .eq("is_teeth", true)
    .eq("teeth_ocr_pending", true)
    .is("sales_cancelled_at", null)
    .select("id");

  if (error) throw new Error(error.message);

  // Usuń zdjęcia z Storage po udanej aktualizacji.
  const imagePaths = (beforeRows ?? [])
    .map((r) => r.teeth_ocr_image_path)
    .filter((p): p is string => Boolean(p));
  if (imagePaths.length > 0) {
    const { error: rmError } = await supabase.storage
      .from("teeth-ocr-images")
      .remove(imagePaths);
    if (rmError) {
      console.error("[approveTeethOcr] Storage cleanup error:", rmError.message);
    }
  }

  return { updated: data?.length ?? 0 };
}
