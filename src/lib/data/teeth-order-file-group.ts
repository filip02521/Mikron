import type { SupabaseClient } from "@supabase/supabase-js";
import { TEETH_QUEUE_PENDING_STATUSES } from "@/lib/data/teeth-queue-shared";
import {
  orderHasTeethOrderFile,
  TEETH_GROUP_ORDER_FILE_FALLBACK_NAME,
  teethOrderFileGroupKey,
  teethSupplierGroupsWithOrderFile,
  type TeethMarkOrderedOrderInput,
} from "@/lib/teeth/teeth-mark-ordered";

export type TeethPendingFileGroupRow = {
  id: string;
  supplier_id: string | null;
  teeth_order_file_path: string | null;
  teeth_order_file_name: string | null;
};

const TEETH_FILE_GROUP_ID_CHUNK = 80;

function pendingTeethFileGroupQuery(supabase: SupabaseClient) {
  return supabase
    .from("individual_orders")
    .select("id, supplier_id, teeth_order_file_path, teeth_order_file_name")
    .eq("is_teeth", true)
    .in("status", [...TEETH_QUEUE_PENDING_STATUSES])
    .is("sales_cancelled_at", null);
}

/**
 * Oczekujące prośby zębowe w tych samych grupach dostawcy.
 * Jeden plik w grupie pokrywa wszystkie — serwer musi znać rodzeństwo.
 */
export async function fetchPendingTeethFileGroupSiblings(
  supabase: SupabaseClient,
  supplierIds: Array<string | null>
): Promise<TeethPendingFileGroupRow[]> {
  const unique = [...new Set(supplierIds.map((id) => id?.trim() || null))];
  if (unique.length === 0) return [];

  const named = unique.filter((id): id is string => Boolean(id));
  const hasNull = unique.some((id) => id == null);
  const rows: TeethPendingFileGroupRow[] = [];

  if (named.length > 0) {
    const { data, error } = await pendingTeethFileGroupQuery(supabase).in(
      "supplier_id",
      named
    );
    if (error) throw new Error(error.message);
    rows.push(...((data ?? []) as TeethPendingFileGroupRow[]));
  }

  if (hasNull) {
    const { data, error } = await pendingTeethFileGroupQuery(supabase).is(
      "supplier_id",
      null
    );
    if (error) throw new Error(error.message);
    rows.push(...((data ?? []) as TeethPendingFileGroupRow[]));
  }

  const byId = new Map<string, TeethPendingFileGroupRow>();
  for (const row of rows) {
    if (row.id) byId.set(row.id, row);
  }
  return [...byId.values()];
}

export function unionTeethFileGroupOrderIds(
  currentOrderId: string,
  siblings: readonly { id: string }[]
): string[] {
  return [...new Set([currentOrderId, ...siblings.map((row) => row.id)].filter(Boolean))];
}

/** Uzupełnia mapę o rodzeństwo z plikiem (bez nadpisywania pełnych rekordów). */
export function mergeTeethFileGroupSiblingsIntoOrders(
  ordersById: Map<string, TeethMarkOrderedOrderInput>,
  siblings: readonly TeethPendingFileGroupRow[]
): void {
  for (const row of siblings) {
    if (ordersById.has(row.id)) continue;
    ordersById.set(row.id, {
      supplier_id: row.supplier_id,
      teeth_order_file_path: row.teeth_order_file_path,
      teeth_order_file_name: row.teeth_order_file_name,
    });
  }
}

export function firstTeethOrderFileInGroup(
  orders: Iterable<TeethMarkOrderedOrderInput>,
  groupKey: string
): { path: string; name: string } | null {
  for (const order of orders) {
    if (teethOrderFileGroupKey(order) !== groupKey) continue;
    if (!orderHasTeethOrderFile(order) || !order.teeth_order_file_path?.trim()) {
      continue;
    }
    return {
      path: order.teeth_order_file_path.trim(),
      name: order.teeth_order_file_name?.trim() || TEETH_GROUP_ORDER_FILE_FALLBACK_NAME,
    };
  }
  return null;
}

export function uncoveredTeethOrderIdsMissingGroupFile(
  ordersById: Map<string, TeethMarkOrderedOrderInput>
): string[] {
  const groupsWithFile = teethSupplierGroupsWithOrderFile(ordersById.values());
  const ids: string[] = [];
  for (const [id, order] of ordersById) {
    if (orderHasTeethOrderFile(order)) continue;
    if (!groupsWithFile.has(teethOrderFileGroupKey(order))) continue;
    ids.push(id);
  }
  return ids;
}

async function updateTeethOrderFileOnIds(
  supabase: SupabaseClient,
  orderIds: readonly string[],
  patch: { teeth_order_file_path: string | null; teeth_order_file_name: string | null }
): Promise<void> {
  const unique = [...new Set(orderIds.filter(Boolean))];
  for (let i = 0; i < unique.length; i += TEETH_FILE_GROUP_ID_CHUNK) {
    const chunk = unique.slice(i, i + TEETH_FILE_GROUP_ID_CHUNK);
    const { error } = await supabase
      .from("individual_orders")
      .update(patch)
      .in("id", chunk)
      .eq("is_teeth", true)
      .in("status", [...TEETH_QUEUE_PENDING_STATUSES])
      .is("sales_cancelled_at", null);
    if (error) throw new Error(error.message);
  }
}

export async function applyTeethOrderFileToPendingGroup(
  supabase: SupabaseClient,
  orderIds: readonly string[],
  file: { path: string; name: string | null }
): Promise<void> {
  await updateTeethOrderFileOnIds(supabase, orderIds, {
    teeth_order_file_path: file.path,
    teeth_order_file_name: file.name,
  });
}

export async function clearTeethOrderFileOnPendingGroup(
  supabase: SupabaseClient,
  orderIds: readonly string[]
): Promise<void> {
  await updateTeethOrderFileOnIds(supabase, orderIds, {
    teeth_order_file_path: null,
    teeth_order_file_name: null,
  });
}

/**
 * Żeby handlowiec w Moje widział plik grupy — skopiuj metadane na wszystkie
 * oczekujące prośby w grupie bez własnego pliku (także te, których nie oznaczamy).
 */
export async function copySharedTeethOrderFileOntoUncoveredSiblings(
  supabase: SupabaseClient,
  ordersById: Map<string, TeethMarkOrderedOrderInput>
): Promise<void> {
  const missingIds = uncoveredTeethOrderIdsMissingGroupFile(ordersById);
  if (missingIds.length === 0) return;

  const byPath = new Map<string, { name: string; ids: string[] }>();
  for (const id of missingIds) {
    const order = ordersById.get(id);
    if (!order) continue;
    const file = firstTeethOrderFileInGroup(
      ordersById.values(),
      teethOrderFileGroupKey(order)
    );
    if (!file) continue;
    const entry = byPath.get(file.path) ?? { name: file.name, ids: [] };
    entry.ids.push(id);
    byPath.set(file.path, entry);
  }

  for (const [path, { name, ids }] of byPath) {
    await applyTeethOrderFileToPendingGroup(supabase, ids, { path, name });
  }
}
