"use server";

import { requireWarehouse } from "@/lib/auth";
import { fetchWarehouseCarriers } from "@/lib/data/warehouse-carriers";
import {
  fetchUpcomingDeliveries,
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
};

export async function actionFetchUpcomingDeliveries(
  dateFrom: string,
  dateTo: string
): Promise<UpcomingDeliveriesPayload> {
  await requireWarehouse();
  const carriers = await fetchWarehouseCarriers();
  const days = await fetchUpcomingDeliveries(dateFrom, dateTo, carriers);
  const summary = summarizeUpcomingDeliveries(days);
  return { days, summary, dateFrom, dateTo };
}

export async function actionFetchUpcomingDeliveriesByPreset(
  preset: UpcomingDeliveryRangePreset
): Promise<UpcomingDeliveriesPayload> {
  await requireWarehouse();
  const { dateFrom, dateTo } = upcomingDeliveryPresetRange(preset);
  const carriers = await fetchWarehouseCarriers();
  const days = await fetchUpcomingDeliveries(dateFrom, dateTo, carriers);
  const summary = summarizeUpcomingDeliveries(days);
  return { days, summary, dateFrom, dateTo };
}
