import { escapeIlikePattern } from "@/lib/security/ilike-pattern";
import { orderExplicitlyLinkedToZkWatch } from "@/lib/orders/zk-prosba-source";
import { clientsMatchForZk } from "@/lib/sales/zk-watch-order-link";
import type { ZkLinkableOrder } from "@/lib/sales/zk-watch-order-link";
import {
  ZK_LINKABLE_ORDER_SELECT,
  ZK_PENDING_ACK_OR_FILTER,
} from "@/lib/sales/zk-linkable-order-select";
import { normalizeSalesClientKhId } from "@/lib/orders/sales-client-match";
import { extractZkSerial } from "@/lib/subiekt/zk-document";
import type { SalesZkWatch } from "@/types/database";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  collectZkWatchPendingAckItems,
  isZkWatchPendingAckOrder,
  type ZkWatchPendingAckItem,
} from "./zk-watch-close-pending";

const PAGE_SIZE = 500;
const MAX_PAGINATED_ROWS = 10_000;

function dedupeOrders(orders: ZkLinkableOrder[]): ZkLinkableOrder[] {
  const byId = new Map<string, ZkLinkableOrder>();
  for (const order of orders) {
    byId.set(order.id, order);
  }
  return [...byId.values()];
}

async function fetchPaginatedOrders(
  supabase: SupabaseClient,
  buildQuery: (from: number, to: number) => PromiseLike<{
    data: ZkLinkableOrder[] | null;
    error: { message: string } | null;
  }>
): Promise<ZkLinkableOrder[]> {
  const all: ZkLinkableOrder[] = [];
  let from = 0;

  while (from < MAX_PAGINATED_ROWS) {
    const to = from + PAGE_SIZE - 1;
    const { data, error } = await buildQuery(from, to);
    if (error) throw new Error(error.message);

    const batch = data ?? [];
    all.push(...batch);
    if (batch.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }

  return all;
}

/** Pobiera wszystkie prośby handlowca używane w notatniku (bez limitu 400). */
export async function fetchAllZkLinkableOrdersForSalesPerson(
  supabase: SupabaseClient,
  salesPersonId: string
): Promise<ZkLinkableOrder[]> {
  return fetchPaginatedOrders(supabase, (from, to) =>
    supabase
      .from("individual_orders")
      .select(ZK_LINKABLE_ORDER_SELECT)
      .eq("sales_person_id", salesPersonId)
      .or(ZK_PENDING_ACK_OR_FILTER)
      .order("action_at", { ascending: false })
      .range(from, to)
      .then(({ data, error }) => ({
        data: (data ?? []) as ZkLinkableOrder[],
        error,
      }))
  );
}

async function fetchExplicitZkLinkedOrders(
  supabase: SupabaseClient,
  salesPersonId: string,
  watch: SalesZkWatch
): Promise<ZkLinkableOrder[]> {
  const batches: ZkLinkableOrder[] = [];

  const { data: byWatchId, error: watchIdError } = await supabase
    .from("individual_orders")
    .select(ZK_LINKABLE_ORDER_SELECT)
    .eq("sales_person_id", salesPersonId)
    .eq("source_zk_watch_id", watch.id);

  if (watchIdError) throw new Error(watchIdError.message);
  batches.push(...((byWatchId ?? []) as ZkLinkableOrder[]));

  const zkNumber = watch.zk_number?.trim();
  if (!zkNumber) return dedupeOrders(batches);

  const { data: exactZk, error: exactError } = await supabase
    .from("individual_orders")
    .select(ZK_LINKABLE_ORDER_SELECT)
    .eq("sales_person_id", salesPersonId)
    .eq("source_zk_number", zkNumber);

  if (exactError) throw new Error(exactError.message);
  if (exactZk?.length) batches.push(...(exactZk as ZkLinkableOrder[]));

  const serial = extractZkSerial(zkNumber);
  if (serial) {
    const pattern = `%${escapeIlikePattern(serial)}%`;
    const { data: bySerial, error: serialError } = await supabase
      .from("individual_orders")
      .select(ZK_LINKABLE_ORDER_SELECT)
      .eq("sales_person_id", salesPersonId)
      .not("source_zk_number", "is", null)
      .ilike("source_zk_number", pattern);

    if (serialError) throw new Error(serialError.message);
    batches.push(
      ...((bySerial ?? []) as ZkLinkableOrder[]).filter((order) =>
        orderExplicitlyLinkedToZkWatch(order, watch)
      )
    );
  }

  return dedupeOrders(batches);
}

/** Prośby klienta bez kh, dopasowane po etykiecie (gdy ZK ma kh_Id). */
async function fetchLabelCompanionOrdersForZkKh(
  supabase: SupabaseClient,
  salesPersonId: string,
  watch: SalesZkWatch
): Promise<ZkLinkableOrder[]> {
  const label = watch.client_label?.trim();
  if (!label) return [];

  const orders = await fetchPaginatedOrders(supabase, (from, to) =>
    supabase
      .from("individual_orders")
      .select(ZK_LINKABLE_ORDER_SELECT)
      .eq("sales_person_id", salesPersonId)
      .is("sales_client_kh_id", null)
      .ilike("sales_client_name", escapeIlikePattern(label))
      .or(ZK_PENDING_ACK_OR_FILTER)
      .order("action_at", { ascending: false })
      .range(from, to)
      .then(({ data, error }) => ({
        data: (data ?? []) as ZkLinkableOrder[],
        error,
      }))
  );

  return orders.filter((order) => clientsMatchForZk(watch, order));
}

/**
 * Kandydaci do potwierdzenia przy zamykaniu konkretnego ZK —
 * bez limitu wierszy, z RLS użytkownika.
 */
export async function fetchZkWatchPendingAckOrderCandidates(
  watch: SalesZkWatch,
  supabase: SupabaseClient
): Promise<ZkLinkableOrder[]> {
  const salesPersonId = watch.sales_person_id;
  const batches: ZkLinkableOrder[][] = [];

  batches.push(await fetchExplicitZkLinkedOrders(supabase, salesPersonId, watch));

  const clientKhId = normalizeSalesClientKhId(watch.client_kh_id);
  if (clientKhId != null) {
    const clientOrders = await fetchPaginatedOrders(supabase, (from, to) =>
      supabase
        .from("individual_orders")
        .select(ZK_LINKABLE_ORDER_SELECT)
        .eq("sales_person_id", salesPersonId)
        .eq("sales_client_kh_id", clientKhId)
        .or(ZK_PENDING_ACK_OR_FILTER)
        .order("action_at", { ascending: false })
        .range(from, to)
        .then(({ data, error }) => ({
          data: (data ?? []) as ZkLinkableOrder[],
          error,
        }))
    );
    batches.push(clientOrders);
    batches.push(await fetchLabelCompanionOrdersForZkKh(supabase, salesPersonId, watch));
  } else {
    const pendingForSalesPerson = await fetchPaginatedOrders(supabase, (from, to) =>
      supabase
        .from("individual_orders")
        .select(ZK_LINKABLE_ORDER_SELECT)
        .eq("sales_person_id", salesPersonId)
        .or(ZK_PENDING_ACK_OR_FILTER)
        .order("action_at", { ascending: false })
        .range(from, to)
        .then(({ data, error }) => ({
          data: (data ?? []) as ZkLinkableOrder[],
          error,
        }))
    );
    batches.push(
      pendingForSalesPerson.filter((order) => clientsMatchForZk(watch, order))
    );
  }

  return dedupeOrders(batches.flat()).filter((order) => isZkWatchPendingAckOrder(order));
}

export async function resolveZkWatchPendingAckItemsForWatch(
  watch: SalesZkWatch,
  supabase: SupabaseClient
): Promise<ZkWatchPendingAckItem[]> {
  const orders = await fetchZkWatchPendingAckOrderCandidates(watch, supabase);
  return collectZkWatchPendingAckItems(watch, orders);
}
