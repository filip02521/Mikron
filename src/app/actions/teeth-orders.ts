"use server";

import { revalidatePath } from "next/cache";
import { requireTeethPanel } from "@/lib/auth";
import {
  fetchTeethQueue,
  fetchTeethHistory,
  markTeethOrdered,
  unmarkTeethOrdered,
  overrideTeethDeliveryDate,
  clearTeethDeliveryDateOverride,
  type TeethQueueGroup,
  type TeethQueueItem,
} from "@/lib/data/teeth-queue";
import {
  fetchTeethSchedules,
  upsertTeethSchedule,
  removeTeethSchedule,
  shiftTeethSchedule,
  markTeethScheduleOrdered,
  fetchAvailableSuppliersForTeethSchedule,
} from "@/lib/data/teeth-schedule";
import type { DayOfWeek, TeethSupplierScheduleWithSupplier } from "@/types/database";

export type TeethQueueResult = {
  groups: TeethQueueGroup[];
};

export async function actionFetchTeethQueue(): Promise<TeethQueueResult> {
  await requireTeethPanel("read");
  const groups = await fetchTeethQueue();
  return { groups };
}

export async function actionFetchTeethHistory(
  supplierId?: string | null
): Promise<TeethQueueItem[]> {
  await requireTeethPanel("read");
  return fetchTeethHistory(supplierId);
}

export async function actionMarkTeethOrdered(
  orderIds: string[]
): Promise<{ success: boolean; updated: number }> {
  const user = await requireTeethPanel("mutate");
  const result = await markTeethOrdered(orderIds, user.id);
  revalidatePath("/zeby");
  revalidatePath("/podsumowanie");
  revalidatePath("/kolejka");
  revalidatePath("/moje");
  return { success: true, updated: result.updated };
}

export async function actionUnmarkTeethOrdered(
  orderIds: string[]
): Promise<{ success: boolean; updated: number }> {
  await requireTeethPanel("mutate");
  const result = await unmarkTeethOrdered(orderIds);
  revalidatePath("/zeby");
  revalidatePath("/podsumowanie");
  revalidatePath("/kolejka");
  revalidatePath("/moje");
  return { success: true, updated: result.updated };
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
  await upsertTeethSchedule(supplierId, orderDayOfWeek, intervalWeeks);
  revalidatePath("/zeby");
  return { success: true };
}

export async function actionRemoveTeethSchedule(
  supplierId: string
): Promise<{ success: boolean }> {
  await requireTeethPanel("mutate");
  await removeTeethSchedule(supplierId);
  revalidatePath("/zeby");
  return { success: true };
}

export async function actionShiftTeethSchedule(
  supplierId: string,
  manualDate: string | null
): Promise<{ success: boolean }> {
  await requireTeethPanel("mutate");
  const date = manualDate ? new Date(manualDate) : null;
  await shiftTeethSchedule(supplierId, date);
  revalidatePath("/zeby");
  return { success: true };
}

export async function actionMarkTeethScheduleOrdered(
  supplierId: string
): Promise<{ success: boolean }> {
  await requireTeethPanel("mutate");
  await markTeethScheduleOrdered(supplierId, new Date());
  revalidatePath("/zeby");
  return { success: true };
}

export async function actionOverrideTeethDeliveryDate(
  orderIds: string[],
  deliveryDate: string
): Promise<{ success: boolean; updated: number }> {
  await requireTeethPanel("mutate");
  const result = await overrideTeethDeliveryDate(orderIds, deliveryDate);
  revalidatePath("/zeby");
  revalidatePath("/moje");
  return { success: true, updated: result.updated };
}

export async function actionClearTeethDeliveryDateOverride(
  orderIds: string[]
): Promise<{ success: boolean; updated: number }> {
  await requireTeethPanel("mutate");
  const result = await clearTeethDeliveryDateOverride(orderIds);
  revalidatePath("/zeby");
  revalidatePath("/moje");
  return { success: true, updated: result.updated };
}
