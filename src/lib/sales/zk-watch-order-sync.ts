import { createAdminClient } from "@/lib/supabase/admin";
import {
  checksFromMergedViews,
  isDeliveredOrderStatus,
  isOrderRelevantToZkWatch,
  mergeZkLineChecksFromDeliveredOrders,
  orderHasExplicitZkLink,
  type ZkLinkableOrder,
} from "@/lib/sales/zk-watch-order-link";
import {
  fetchZkLinkableOrdersForSalesPerson,
  isZkWatchArchived,
} from "@/lib/data/sales-notepad";
import { orderExplicitlyLinkedToZkWatch } from "@/lib/orders/zk-prosba-source";
import { normalizeSalesClientKhId } from "@/lib/orders/sales-client-match";
import { searchQueryTokens } from "@/lib/orders/my-order-search";
import { extractZkSerial } from "@/lib/subiekt/zk-document";
import { escapeIlikePattern } from "@/lib/security/ilike-pattern";
import type { IndividualOrder, SalesZkWatch } from "@/types/database";

const MAX_PERSIST_ATTEMPTS = 6;

const OPEN_ZK_WATCH_SELECT =
  "id, sales_person_id, client_kh_id, client_label, zk_number, closed_at, archived_at";

function createOpenZkWatchQuery(salesPersonId: string) {
  return createAdminClient()
    .from("sales_zk_watches")
    .select(OPEN_ZK_WATCH_SELECT)
    .eq("sales_person_id", salesPersonId)
    .is("closed_at", null)
    .is("archived_at", null);
}

export function shouldSyncZkWatchLineChecksAfterDeliveryChange(
  prevStatus: string,
  nextStatus: string,
  prevDeliveredQty: string | null | undefined,
  nextDeliveredQty: string
): boolean {
  const prevDelivered = isDeliveredOrderStatus(prevStatus);
  const nextDelivered = isDeliveredOrderStatus(nextStatus);
  if (prevDelivered || nextDelivered) return true;
  return (prevDeliveredQty ?? "-") !== nextDeliveredQty;
}

export function individualOrderToZkLinkableOrder(
  order: IndividualOrder
): ZkLinkableOrder {
  return {
    id: order.id,
    sales_person_id: order.sales_person_id,
    sales_client_name: order.sales_client_name ?? null,
    sales_client_kh_id: order.sales_client_kh_id ?? null,
    source_zk_watch_id: order.source_zk_watch_id ?? null,
    source_zk_number: order.source_zk_number ?? null,
    subiekt_tw_id: order.subiekt_tw_id ?? null,
    symbol: order.symbol ?? null,
    products: order.products ?? null,
    mikran_code: order.mikran_code ?? null,
    quantity: order.quantity,
    delivered_quantity: order.delivered_quantity,
    status: order.status,
    request_kind: order.request_kind ?? null,
    ordered_at: order.ordered_at ?? null,
    action_at: order.action_at ?? null,
    delivery_at: order.delivery_at ?? null,
    zd_fulfillment_deadline: order.zd_fulfillment_deadline ?? null,
    zd_fulfillment_previous_deadline: order.zd_fulfillment_previous_deadline ?? null,
    zd_fulfillment_deadline_changed_at: order.zd_fulfillment_deadline_changed_at ?? null,
    zd_fulfillment_deadline_change_seen_at:
      order.zd_fulfillment_deadline_change_seen_at ?? null,
    is_teeth: order.is_teeth ?? null,
    informacja_stock_out_reorder: order.informacja_stock_out_reorder ?? null,
    sales_acknowledged_at: order.sales_acknowledged_at ?? null,
    sales_cancelled_at: order.sales_cancelled_at ?? null,
  };
}

export { escapeIlikePattern };

/** ZK z client_kh_id=null wymaga nazwy klienta na prośbie (exact label). */
export function shouldFetchNullKhCompanionWatches(
  orderKh: number | null,
  clientName: string | null | undefined
): boolean {
  return orderKh != null && Boolean(clientName?.trim());
}

/** Filtr Supabase `.or()` — zawęża ZK po tokenach nazwy klienta. */
export function buildClientLabelIlikeOrFilter(
  clientName: string | null | undefined
): string | null {
  const tokens = searchQueryTokens(clientName ?? "");
  if (!tokens.length) return null;
  return tokens
    .map((token) => `client_label.ilike.%${escapeIlikePattern(token)}%`)
    .join(",");
}

export function dedupeWatchRows(rows: SalesZkWatch[]): SalesZkWatch[] {
  const byId = new Map<string, SalesZkWatch>();
  for (const row of rows) {
    byId.set(row.id, row);
  }
  return [...byId.values()];
}

export function dedupeWatchIds(ids: string[]): string[] {
  return [...new Set(ids)];
}

function filterRelevantWatches(
  linkable: ZkLinkableOrder,
  watches: SalesZkWatch[]
): SalesZkWatch[] {
  return watches.filter((watch) => isOrderRelevantToZkWatch(linkable, watch));
}

async function fetchWatchesMatchingClientLabel(
  salesPersonId: string,
  clientName: string | null | undefined
): Promise<SalesZkWatch[]> {
  const orFilter = buildClientLabelIlikeOrFilter(clientName);
  if (!orFilter) return [];

  const { data, error } = await createOpenZkWatchQuery(salesPersonId).or(orFilter);
  if (error) {
    console.error("[fetchOpenZkWatchesForOrderSync] client label filter", error.message);
    return [];
  }
  return (data ?? []) as SalesZkWatch[];
}

async function fetchExplicitLinkWatchCandidates(
  salesPersonId: string,
  linkable: ZkLinkableOrder,
  zkNumber: string | null | undefined
): Promise<SalesZkWatch[]> {
  const openQuery = () => createOpenZkWatchQuery(salesPersonId);
  const candidates: SalesZkWatch[] = [];

  if (zkNumber) {
    const { data: exact, error: exactError } = await openQuery().eq("zk_number", zkNumber);
    if (exactError) {
      console.error("[fetchOpenZkWatchesForOrderSync] zk_number exact", exactError.message);
    } else if (exact?.length) {
      candidates.push(...(exact as SalesZkWatch[]));
    }

    if (!candidates.some((watch) => orderExplicitlyLinkedToZkWatch(linkable, watch))) {
      const serial = extractZkSerial(zkNumber);
      if (serial) {
        const pattern = `%${escapeIlikePattern(serial)}/M/%`;
        const { data: bySerial, error: serialError } = await openQuery().ilike(
          "zk_number",
          pattern
        );
        if (serialError) {
          console.error(
            "[fetchOpenZkWatchesForOrderSync] zk_number serial",
            serialError.message
          );
        } else if (bySerial?.length) {
          candidates.push(...(bySerial as SalesZkWatch[]));
        }
      }
    }
  }

  const linked = dedupeWatchRows(candidates).filter((watch) =>
    orderExplicitlyLinkedToZkWatch(linkable, watch)
  );
  if (linked.length) return linked;

  const { data: open, error } = await openQuery();
  if (error) {
    console.error("[fetchOpenZkWatchesForOrderSync] explicit link fallback", error.message);
    return [];
  }
  return filterRelevantWatches(linkable, (open ?? []) as SalesZkWatch[]);
}

/** Pobiera tylko otwarte ZK, które mogą wymagać sync po zmianie tej prośby. */
export async function fetchOpenZkWatchesForOrderSync(
  order: IndividualOrder
): Promise<SalesZkWatch[]> {
  const linkable = individualOrderToZkLinkableOrder(order);
  const salesPersonId = order.sales_person_id;

  const watchId = order.source_zk_watch_id?.trim();
  if (watchId) {
    const { data, error } = await createOpenZkWatchQuery(salesPersonId)
      .eq("id", watchId)
      .maybeSingle();
    if (error) {
      console.error("[fetchOpenZkWatchesForOrderSync] watch id", error.message);
    } else if (data) {
      const watch = data as SalesZkWatch;
      if (isOrderRelevantToZkWatch(linkable, watch)) return [watch];
    }
  }

  if (orderHasExplicitZkLink(linkable)) {
    return filterRelevantWatches(
      linkable,
      await fetchExplicitLinkWatchCandidates(
        salesPersonId,
        linkable,
        order.source_zk_number?.trim() || null
      )
    );
  }

  const orderKh = normalizeSalesClientKhId(order.sales_client_kh_id);
  const clientName = order.sales_client_name;

  if (orderKh != null) {
    const byKhPromise = createOpenZkWatchQuery(salesPersonId).eq("client_kh_id", orderKh);
    const nullKhPromise = shouldFetchNullKhCompanionWatches(orderKh, clientName)
      ? (() => {
          const orFilter = buildClientLabelIlikeOrFilter(clientName);
          return orFilter
            ? createOpenZkWatchQuery(salesPersonId).is("client_kh_id", null).or(orFilter)
            : null;
        })()
      : null;

    const [byKh, byNullKh] = await Promise.all([
      byKhPromise,
      nullKhPromise ?? Promise.resolve({ data: [], error: null }),
    ]);

    if (byKh.error) {
      console.error("[fetchOpenZkWatchesForOrderSync] client kh", byKh.error.message);
      return [];
    }
    if (byNullKh.error) {
      console.error("[fetchOpenZkWatchesForOrderSync] null kh", byNullKh.error.message);
      return [];
    }

    const merged = dedupeWatchRows([
      ...((byKh.data ?? []) as SalesZkWatch[]),
      ...((byNullKh.data ?? []) as SalesZkWatch[]),
    ]);
    return filterRelevantWatches(linkable, merged);
  }

  if (!clientName?.trim()) return [];

  const byLabel = await fetchWatchesMatchingClientLabel(salesPersonId, clientName);
  return filterRelevantWatches(linkable, byLabel);
}

export async function resolveZkWatchIdsToSyncForOrder(
  order: IndividualOrder
): Promise<string[]> {
  const watches = await fetchOpenZkWatchesForOrderSync(order);
  return dedupeWatchIds(watches.map((watch) => watch.id));
}

async function persistWatchLineChecksWithRetry(
  watchId: string,
  linkableOrders: ZkLinkableOrder[]
): Promise<void> {
  const supabase = createAdminClient();

  for (let attempt = 0; attempt < MAX_PERSIST_ATTEMPTS; attempt++) {
    const { data: fresh, error: freshError } = await supabase
      .from("sales_zk_watches")
      .select("*")
      .eq("id", watchId)
      .maybeSingle();

    if (freshError || !fresh) return;
    const current = fresh as SalesZkWatch;
    if (isZkWatchArchived(current)) return;

    const { checks, changed } = mergeZkLineChecksFromDeliveredOrders(
      current,
      linkableOrders
    );
    if (!changed) return;

    const sanitized = checksFromMergedViews(current, checks);
    const now = new Date().toISOString();
    const { data: updated, error: updateError } = await supabase
      .from("sales_zk_watches")
      .update({ line_checks: sanitized, updated_at: now })
      .eq("id", current.id)
      .eq("updated_at", current.updated_at)
      .select("id")
      .maybeSingle();

    if (!updateError && updated) return;

    if (attempt === MAX_PERSIST_ATTEMPTS - 1) {
      console.error(
        "[syncZkWatchLineChecksFromOrder] optimistic lock failed",
        watchId,
        updateError?.message
      );
    }

    await new Promise((resolve) => setTimeout(resolve, 40 * (attempt + 1)));
  }
}

/** Po zmianie dostawy prośby — przelicz line_checks w powiązanych ZK. */
export async function syncZkWatchLineChecksFromOrder(
  order: IndividualOrder
): Promise<void> {
  const watchIds = await resolveZkWatchIdsToSyncForOrder(order);
  if (!watchIds.length) return;

  const { orders: linkableOrders } = await fetchZkLinkableOrdersForSalesPerson(
    order.sales_person_id
  );

  await Promise.all(
    watchIds.map((watchId) => persistWatchLineChecksWithRetry(watchId, linkableOrders))
  );
}

/** @deprecated użyj syncZkWatchLineChecksFromOrder */
export async function syncZkWatchLineChecksFromDeliveredOrder(
  order: IndividualOrder
): Promise<void> {
  return syncZkWatchLineChecksFromOrder(order);
}
