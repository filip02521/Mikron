"use server";

import { revalidatePath } from "next/cache";
import { requireTeethPanel } from "@/lib/auth";
import {
  fetchTeethQueue,
  fetchTeethHistory,
  fetchTeethHistoryGroups,
  fetchTeethHistoryPage,
  markTeethOrdered,
  markTeethPositionsOrdered,
  unmarkTeethOrdered,
  overrideTeethDeliveryDate,
  clearTeethDeliveryDateOverride,
  type TeethHistoryFetchOptions,
  type TeethQueueGroup,
  type TeethQueueItem,
  type TeethPositionSelection,
} from "@/lib/data/teeth-queue";
import { fetchTeethOrderEditContext, type TeethEditContext } from "@/lib/data/teeth-edit-context";
import {
  fetchTeethOrderHistoryAudit,
  type TeethOrderHistoryRow,
} from "@/lib/data/teeth-order-history";
import {
  fetchTeethSchedules,
  fetchTeethScheduleForSupplier,
  upsertTeethSchedule,
  removeTeethSchedule,
  shiftTeethSchedule,
  markTeethScheduleOrdered,
  fetchAvailableSuppliersForTeethSchedule,
} from "@/lib/data/teeth-schedule";
import type { DayOfWeek, TeethSupplierSchedule, TeethSupplierScheduleWithSupplier } from "@/types/database";
import type { SessionUser } from "@/lib/auth";

function teethHistoryActor(user: SessionUser) {
  return { id: user.id, email: user.email };
}

function revalidateTeethSupplierPaths() {
  revalidatePath("/zeby");
  revalidatePath("/zakupy/dostawcy");
}

export type TeethQueueResult = {
  groups: TeethQueueGroup[];
};

export async function actionFetchTeethQueue(): Promise<TeethQueueResult> {
  await requireTeethPanel("read");
  const groups = await fetchTeethQueue();
  return { groups };
}

export async function actionFetchTeethHistory(
  options?: TeethHistoryFetchOptions
): Promise<TeethQueueItem[]> {
  await requireTeethPanel("read");
  return fetchTeethHistory(options);
}

export async function actionFetchTeethHistoryGroups(
  options?: TeethHistoryFetchOptions
): Promise<TeethQueueGroup[]> {
  await requireTeethPanel("read");
  return fetchTeethHistoryGroups(options);
}

export async function actionFetchTeethHistoryPage(
  options?: TeethHistoryFetchOptions
): Promise<Awaited<ReturnType<typeof fetchTeethHistoryPage>>> {
  await requireTeethPanel("read");
  return fetchTeethHistoryPage(options);
}

export async function actionFetchTeethOrderHistoryAudit(
  options?: { limit?: number; supplierId?: string | null }
): Promise<TeethOrderHistoryRow[]> {
  await requireTeethPanel("read");
  return fetchTeethOrderHistoryAudit(options);
}

export async function actionFetchTeethEditContext(
  orderId: string
): Promise<TeethEditContext> {
  await requireTeethPanel("read");
  return fetchTeethOrderEditContext(orderId);
}

export async function actionMarkTeethOrdered(
  orderIds: string[]
): Promise<{ success: boolean; updated: number }> {
  const user = await requireTeethPanel("mutate");
  const result = await markTeethOrdered(orderIds, user.id, teethHistoryActor(user));
  revalidatePath("/zeby");
  revalidatePath("/podsumowanie");
  revalidatePath("/kolejka");
  revalidatePath("/moje");
  return { success: true, updated: result.updated };
}

export async function actionMarkTeethPositionsOrdered(
  selections: TeethPositionSelection[]
): Promise<{ success: boolean; updated: number; ordersCompleted: number }> {
  const user = await requireTeethPanel("mutate");
  const result = await markTeethPositionsOrdered(selections, user.id, teethHistoryActor(user));
  revalidatePath("/zeby");
  revalidatePath("/podsumowanie");
  revalidatePath("/kolejka");
  revalidatePath("/moje");
  return { success: true, updated: result.updated, ordersCompleted: result.ordersCompleted };
}

export async function actionUnmarkTeethOrdered(
  orderIds: string[]
): Promise<{ success: boolean; updated: number }> {
  const user = await requireTeethPanel("mutate");
  const result = await unmarkTeethOrdered(orderIds, teethHistoryActor(user));
  revalidatePath("/zeby");
  revalidatePath("/podsumowanie");
  revalidatePath("/kolejka");
  revalidatePath("/moje");
  return { success: true, updated: result.updated };
}

export async function actionFetchTeethScheduleForSupplier(
  supplierId: string
): Promise<TeethSupplierSchedule | null> {
  await requireTeethPanel("read");
  const id = supplierId?.trim();
  if (!id) return null;
  return fetchTeethScheduleForSupplier(id);
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
  revalidateTeethSupplierPaths();
  return { success: true };
}

export async function actionRemoveTeethSchedule(
  supplierId: string
): Promise<{ success: boolean }> {
  await requireTeethPanel("mutate");
  await removeTeethSchedule(supplierId);
  revalidateTeethSupplierPaths();
  return { success: true };
}

export async function actionShiftTeethSchedule(
  supplierId: string,
  manualDate: string | null
): Promise<{ success: boolean }> {
  const user = await requireTeethPanel("mutate");
  const date = manualDate ? new Date(manualDate) : null;
  await shiftTeethSchedule(supplierId, date, teethHistoryActor(user));
  revalidateTeethSupplierPaths();
  return { success: true };
}

export async function actionMarkTeethScheduleOrdered(
  supplierId: string
): Promise<{ success: boolean }> {
  await requireTeethPanel("mutate");
  await markTeethScheduleOrdered(supplierId, new Date());
  revalidateTeethSupplierPaths();
  return { success: true };
}

export async function actionOverrideTeethDeliveryDate(
  orderIds: string[],
  deliveryDate: string
): Promise<{ success: boolean; updated: number }> {
  const user = await requireTeethPanel("mutate");
  const result = await overrideTeethDeliveryDate(
    orderIds,
    deliveryDate,
    teethHistoryActor(user)
  );
  revalidatePath("/zeby");
  revalidatePath("/moje");
  return { success: true, updated: result.updated };
}

export async function actionClearTeethDeliveryDateOverride(
  orderIds: string[]
): Promise<{ success: boolean; updated: number }> {
  const user = await requireTeethPanel("mutate");
  const result = await clearTeethDeliveryDateOverride(orderIds, teethHistoryActor(user));
  revalidatePath("/zeby");
  revalidatePath("/moje");
  return { success: true, updated: result.updated };
}
