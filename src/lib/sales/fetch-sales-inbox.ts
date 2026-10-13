import { cache } from "react";
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

/*
 * React `cache()` — deduplikacja w obrębie jednego żądania RSC: AppShell (layout) i /moje
 * pobierają te same dane handlowca; drugie wywołanie dostaje tę samą obietnicę.
 * Klucze to wartości prymitywne (obiekt filtrów w literale nie trafiłby w cache).
 * Poza renderem (route handler, akcja) działa jak zwykłe wywołanie.
 */
export const fetchSalesPersonOrdersForRequest = cache((salesPersonId: string) =>
  fetchIndividualOrders({ salesPersonId, hideSalesAcknowledged: false })
);
export const fetchDeliveryStatsForRequest = cache(() => fetchDeliveryStats());
export const fetchSalesDayStartNotepadSliceForRequest = cache(fetchSalesDayStartNotepadSlice);
export const fetchSalesBoardAttentionSnapshotForRequest = cache(fetchSalesBoardAttentionSnapshot);

export type SalesInboxLoadedData = {
  orders: IndividualOrder[];
  statsRows: DeliveryStats[];
  notepadSlice: { zkWatches: SalesZkWatch[]; notes: SalesNote[] };
  boardAttention: SalesBoardAttentionSnapshot | null;
  /** Notatnik nie wczytał się — pokaż to zamiast pustej listy i zerowych liczników. */
  notepadLoadFailed?: boolean;
};

/** Zbuduj inbox z już pobranych danych (bez dodatkowych zapytań o zamówienia). */
export async function buildSalesInboxSnapshotFromLoadedData(
  data: SalesInboxLoadedData
): Promise<SalesDayStartSnapshot> {
  let salesVisibleOrders = filterIndividualOrdersForSalesMyOrders(data.orders);
  if (salesVisibleOrders.some((o) => o.is_teeth)) {
    const { attachTeethDetailsToIndividualOrders } = await import("@/lib/data/teeth-queue");
    salesVisibleOrders = await attachTeethDetailsToIndividualOrders(salesVisibleOrders);
    const { createAdminClient, hasSupabaseConfig } = await import("@/lib/supabase/admin");
    if (hasSupabaseConfig()) {
      const { enrichSalesOrdersWithTeethOrderFileMeta } = await import(
        "@/lib/data/teeth-order-file-group"
      );
      salesVisibleOrders = await enrichSalesOrdersWithTeethOrderFileMeta(
        createAdminClient(),
        salesVisibleOrders
      );
    }
  }

  const todayDateKey = formatDateString(todayInWarsaw());
  const [{ supplierScheduleById, weekDays }, teethLeadDaysBySupplierId, etaQuantiles] =
    await Promise.all([
      loadPlannedOrderScheduleContext(salesVisibleOrders, todayDateKey),
      (async () => {
        const { loadTeethLeadDaysBySupplierIdForOrders } = await import(
          "@/lib/orders/teeth-lead-days-for-presenter"
        );
        return loadTeethLeadDaysBySupplierIdForOrders(salesVisibleOrders);
      })(),
      (async () => {
        const { loadDeliveryEtaQuantilesForOrders } = await import(
          "@/lib/orders/delivery-eta-quantiles-load"
        );
        return loadDeliveryEtaQuantilesForOrders(salesVisibleOrders);
      })(),
    ]);

  const { zamowienia, informacje } = presentMyOrders(salesVisibleOrders, data.statsRows, {
    supplierScheduleById,
    todayDateKey,
    weekDays,
    teethLeadDaysBySupplierId,
    useP50: etaQuantiles.useP50,
    etaQuantilesBySupplierId: etaQuantiles.bySupplierId,
  });

  return buildSalesDayStartSnapshot({
    rows: [...zamowienia, ...informacje],
    watches: data.notepadSlice.zkWatches,
    notes: data.notepadSlice.notes,
    boardAttention: data.boardAttention,
    notepadLoadFailed: data.notepadLoadFailed,
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
  let notepadLoadFailed = false;
  const [orders, statsRows, notepadSlice, boardAttention] = await Promise.all([
    fetchSalesPersonOrdersForRequest(salesPersonId),
    fetchDeliveryStatsForRequest(),
    fetchSalesDayStartNotepadSliceForRequest(salesPersonId).catch((e) => {
      console.error("[loadSalesInboxData] notatnik", e);
      notepadLoadFailed = true;
      return { zkWatches: [] as SalesZkWatch[], notes: [] as SalesNote[] };
    }),
    profileId
      ? fetchSalesBoardAttentionSnapshotForRequest(profileId).catch(() => null)
      : Promise.resolve(null),
  ]);

  return {
    orders,
    statsRows: statsRows as DeliveryStats[],
    notepadSlice,
    boardAttention,
    notepadLoadFailed,
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
    // Tablica: tylko własne aktywne pytania z nieprzeczytaną odpowiedzią — nie wszystkie wątki działu.
    boardNavBadge: data.boardAttention?.unseenOwnAnswerCount ?? 0,
  };
}
