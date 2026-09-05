import type { SupabaseClient } from "@/lib/db/admin";
import { TEETH_QUEUE_PENDING_STATUSES } from "@/lib/data/teeth-queue-shared";
import {
  orderHasTeethOrderFile,
  resolveTeethGroupOrderFile,
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

type TeethOrderFileMeta = { path: string; name: string };

/**
 * Plik zamówienia z grupy dostawcy — także spośród już oznaczonych (Zamowione+).
 * Używane przy pobieraniu przez handlowca, gdy wiersz nie ma własnej ścieżki.
 */
export async function fetchTeethOrderFileMetaBySupplierGroups(
  supabase: SupabaseClient,
  supplierIds: Array<string | null>
): Promise<Map<string, TeethOrderFileMeta>> {
  const unique = [...new Set(supplierIds.map((id) => id?.trim() || null))];
  const result = new Map<string, TeethOrderFileMeta>();
  if (unique.length === 0) return result;

  const named = unique.filter((id): id is string => Boolean(id));
  const hasNull = unique.some((id) => id == null);

  const ingest = (
    rows: Array<{
      supplier_id: string | null;
      teeth_order_file_path: string | null;
      teeth_order_file_name: string | null;
    }>
  ) => {
    for (const row of rows) {
      const path = row.teeth_order_file_path?.trim();
      if (!path) continue;
      const key = teethOrderFileGroupKey({ supplier_id: row.supplier_id });
      if (result.has(key)) continue;
      result.set(key, {
        path,
        name: row.teeth_order_file_name?.trim() || TEETH_GROUP_ORDER_FILE_FALLBACK_NAME,
      });
    }
  };

  if (named.length > 0) {
    const { data, error } = await supabase
      .from("individual_orders")
      .select("supplier_id, teeth_order_file_path, teeth_order_file_name")
      .eq("is_teeth", true)
      .in("supplier_id", named)
      .not("teeth_order_file_path", "is", null);
    if (error) throw new Error(error.message);
    ingest((data ?? []) as Array<{
      supplier_id: string | null;
      teeth_order_file_path: string | null;
      teeth_order_file_name: string | null;
    }>);
  }

  if (hasNull) {
    const { data, error } = await supabase
      .from("individual_orders")
      .select("supplier_id, teeth_order_file_path, teeth_order_file_name")
      .eq("is_teeth", true)
      .is("supplier_id", null)
      .not("teeth_order_file_path", "is", null)
      .limit(20);
    if (error) throw new Error(error.message);
    ingest((data ?? []) as Array<{
      supplier_id: string | null;
      teeth_order_file_path: string | null;
      teeth_order_file_name: string | null;
    }>);
  }

  return result;
}

/** Uzupełnia brakujące metadane pliku z mapy grupy (tylko w pamięci — do UI /moje). */
export function attachTeethOrderFileMetaFromGroupMap<
  T extends {
    is_teeth?: boolean | null;
    supplier_id?: string | null;
    teeth_order_file_path?: string | null;
    teeth_order_file_name?: string | null;
  },
>(orders: T[], groupFiles: Map<string, TeethOrderFileMeta>): T[] {
  if (groupFiles.size === 0) return orders;
  return orders.map((order) => {
    if (!order.is_teeth || orderHasTeethOrderFile(order)) return order;
    const file = groupFiles.get(teethOrderFileGroupKey(order));
    if (!file) return order;
    return {
      ...order,
      teeth_order_file_path: file.path,
      teeth_order_file_name: file.name,
    };
  });
}

/** Dla listy handlowca: dociągnij plik grupy, gdy wiersz go nie ma (np. rodzeństwo z plikiem). */
export async function enrichSalesOrdersWithTeethOrderFileMeta<
  T extends {
    is_teeth?: boolean | null;
    supplier_id?: string | null;
    teeth_order_file_path?: string | null;
    teeth_order_file_name?: string | null;
  },
>(supabase: SupabaseClient, orders: T[]): Promise<T[]> {
  const missing = orders.filter(
    (order) => order.is_teeth && !orderHasTeethOrderFile(order)
  );
  if (missing.length === 0) return orders;
  const groupFiles = await fetchTeethOrderFileMetaBySupplierGroups(
    supabase,
    missing.map((order) => order.supplier_id ?? null)
  );
  return attachTeethOrderFileMetaFromGroupMap(orders, groupFiles);
}

export type TeethReceiveSectionOrderFile = {
  groupKey: string;
  orderId: string;
  supplierLabel: string;
  fileName: string;
};

/**
 * Pliki zamówienia do UI przyjęcia — jeden wpis na grupę dostawcy w sekcji.
 * orderId wskazuje wiersz z ścieżką (albo dowolny z grupy, gdy download i tak resolvuje grupę).
 */
export function listTeethOrderFilesForReceiveSection(
  orders: readonly {
    id: string;
    supplier_id?: string | null;
    supplier?: { name?: string | null } | null;
    teeth_order_file_path?: string | null;
    teeth_order_file_name?: string | null;
  }[]
): TeethReceiveSectionOrderFile[] {
  const byGroup = new Map<string, Array<(typeof orders)[number]>>();
  for (const order of orders) {
    const key = teethOrderFileGroupKey(order);
    const list = byGroup.get(key);
    if (list) list.push(order);
    else byGroup.set(key, [order]);
  }

  const result: TeethReceiveSectionOrderFile[] = [];
  for (const [groupKey, groupOrders] of byGroup) {
    const resolved = resolveTeethGroupOrderFile(groupOrders);
    if (!resolved.hasFile || !resolved.fileName) continue;
    const withPath =
      groupOrders.find((order) => orderHasTeethOrderFile(order)) ?? groupOrders[0];
    if (!withPath) continue;
    result.push({
      groupKey,
      orderId: withPath.id,
      supplierLabel: withPath.supplier?.name?.trim() || "Bez dostawcy",
      fileName: resolved.fileName,
    });
  }

  return result.sort((a, b) =>
    a.supplierLabel.localeCompare(b.supplierLabel, "pl", { sensitivity: "base" })
  );
}
