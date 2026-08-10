"use server";

import { requireWarehouse } from "@/lib/auth";
import { fetchWarehouseCarriers } from "@/lib/data/warehouse-carriers";
import {
  fetchUpcomingDeliveriesWithMeta,
  summarizeUpcomingDeliveries,
  upcomingDeliveryPresetRange,
  type UpcomingDeliveryDay,
  type UpcomingDeliveryRangePreset,
  type UpcomingDeliverySummary,
} from "@/lib/data/upcoming-deliveries";

export type UpcomingDeliveriesPayload = {
  days: UpcomingDeliveryDay[];
  summary: UpcomingDeliverySummary;
  dateFrom: string;
  dateTo: string;
  /** Dostawcy z wpisem w dzienniku przyjęć dokładnie na dziś. */
  receivedSupplierIdsToday: string[];
  /** Dostawcy w pełni odznaczeni per termin ZD. */
  clearedSupplierIdsByDate: Record<string, string[]>;
};

export async function actionFetchUpcomingDeliveries(
  dateFrom: string,
  dateTo: string
): Promise<UpcomingDeliveriesPayload> {
  await requireWarehouse();
  const carriers = await fetchWarehouseCarriers();
  const { days, receivedSupplierIdsToday, clearedSupplierIdsByDate } =
    await fetchUpcomingDeliveriesWithMeta(dateFrom, dateTo, carriers);
  const summary = summarizeUpcomingDeliveries(days);
  return {
    days,
    summary,
    dateFrom,
    dateTo,
    receivedSupplierIdsToday,
    clearedSupplierIdsByDate,
  };
}

export async function actionFetchUpcomingDeliveriesByPreset(
  preset: UpcomingDeliveryRangePreset
): Promise<UpcomingDeliveriesPayload> {
  await requireWarehouse();
  const { dateFrom, dateTo } = upcomingDeliveryPresetRange(preset);
  const carriers = await fetchWarehouseCarriers();
  const { days, receivedSupplierIdsToday, clearedSupplierIdsByDate } =
    await fetchUpcomingDeliveriesWithMeta(dateFrom, dateTo, carriers);
  const summary = summarizeUpcomingDeliveries(days);
  return {
    days,
    summary,
    dateFrom,
    dateTo,
    receivedSupplierIdsToday,
    clearedSupplierIdsByDate,
  };
}
