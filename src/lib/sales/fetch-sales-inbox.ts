import {
  fetchDeliveryStats,
  fetchIndividualOrders,
} from "@/lib/data/queries";
import { fetchSalesBoardAttentionSnapshot, type SalesBoardAttentionSnapshot } from "@/lib/data/department-board";
import {
  countNotesDueFromSlice,
  countZkDueFromWatches,
  fetchSalesDayStartNotepadSlice,
} from "@/lib/data/sales-notepad";
import { filterIndividualOrdersForSalesMyOrders } from "@/lib/orders/informacja-stock-out-reorder";
import { formatDateString } from "@/lib/orders/dates";
import { loadPlannedOrderScheduleContext } from "@/lib/orders/planned-order-schedule";
import { presentMyOrders } from "@/lib/orders/my-order-presenter";
import {
  buildSalesDayStartSnapshot,
  type SalesDayStartSnapshot,
} from "@/lib/sales/sales-day-start";
import { todayInWarsaw } from "@/lib/time/warsaw";
import type { DeliveryStats, IndividualOrder, SalesNote, SalesZkWatch } from "@/types/database";

export type SalesInboxLoadedData = {
  orders: IndividualOrder[];
  statsRows: DeliveryStats[];
  notepadSlice: { zkWatches: SalesZkWatch[]; notes: SalesNote[] };
  boardAttention: SalesBoardAttentionSnapshot | null;
};

/** Zbuduj inbox z już pobranych danych (bez dodatkowych zapytań o zamówienia). */
export async function buildSalesInboxSnapshotFromLoadedData(
  data: SalesInboxLoadedData
): Promise<SalesDayStartSnapshot> {
  let salesVisibleOrders = filterIndividualOrdersForSalesMyOrders(data.orders);
  if (salesVisibleOrders.some((o) => o.is_teeth)) {
    const { attachTeethDetailsToIndividualOrders } = await import("@/lib/data/teeth-queue");
    salesVisibleOrders = await attachTeethDetailsToIndividualOrders(salesVisibleOrders);
  }

  const todayDateKey = formatDateString(todayInWarsaw());
  const { supplierScheduleById, weekDays } = await loadPlannedOrderScheduleContext(
    salesVisibleOrders,
    todayDateKey
  );

  const { zamowienia, informacje } = presentMyOrders(salesVisibleOrders, data.statsRows, {
    supplierScheduleById,
    todayDateKey,
    weekDays,
  });

  return buildSalesDayStartSnapshot({
    rows: [...zamowienia, ...informacje],
    watches: data.notepadSlice.zkWatches,
    notes: data.notepadSlice.notes,
    boardAttention: data.boardAttention,
  });
}

/** Pełne pobranie pod API / odświeżenie klienta. */
export async function fetchSalesInboxSnapshot(
  salesPersonId: string,
  profileId: string
): Promise<SalesDayStartSnapshot> {
  const loaded = await loadSalesInboxData(salesPersonId, profileId);
  return buildSalesInboxSnapshotFromLoadedData(loaded);
}

/** Wspólne źródło danych inboxu (jedno zapytanie o zamówienia + notatnik + tablicę). */
export async function loadSalesInboxData(
  salesPersonId: string,
  profileId: string | null
): Promise<SalesInboxLoadedData> {
  const [orders, statsRows, notepadSlice, boardAttention] = await Promise.all([
    fetchIndividualOrders({ salesPersonId, hideSalesAcknowledged: false }),
    fetchDeliveryStats(),
    fetchSalesDayStartNotepadSlice(salesPersonId).catch(() => ({
      zkWatches: [] as SalesZkWatch[],
      notes: [] as SalesNote[],
    })),
    profileId
      ? fetchSalesBoardAttentionSnapshot(profileId).catch(() => null)
      : Promise.resolve(null),
  ]);

  return {
    orders,
    statsRows: statsRows as DeliveryStats[],
    notepadSlice,
    boardAttention,
  };
}

export function inboxNavBadgesFromLoadedData(data: SalesInboxLoadedData): {
  zkNavBadge: number;
  notesNavBadge: number;
  boardNavBadge: number;
} {
  return {
    zkNavBadge: countZkDueFromWatches(data.notepadSlice.zkWatches),
    notesNavBadge: countNotesDueFromSlice(data.notepadSlice.notes),
    boardNavBadge: data.boardAttention?.unseenAnswerCount ?? 0,
  };
}
