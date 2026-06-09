"use server";

import { revalidatePath } from "next/cache";
import { requireWarehouse } from "@/lib/auth";
import { getAppSupplierRefsCached } from "@/lib/data/supplier-refs";
import {
  assertJournalDateReadable,
  createDeliveryReceipt,
  deleteDeliveryReceipt,
  fetchCarrierHintForSupplier,
  fetchDeliveryDatesWithEntries,
  fetchDeliveryReceiptsForDate,
  summarizeDeliveryReceiptsForDate,
  updateDeliveryReceipt,
  warsawTodayDateKey,
  type WarehouseDeliveryReceipt,
} from "@/lib/warehouse/delivery-receipts";
import {
  parseWarehouseCarrier,
  parseWarehouseShipmentForm,
} from "@/lib/warehouse/delivery-carriers";
import {
  searchDeliveryReceipts,
  summarizeDeliveryReceiptsRange,
  type DeliveryJournalRangeSummary,
  type DeliveryJournalSearchFilters,
} from "@/lib/warehouse/delivery-journal-insights";

export async function actionListWarehouseAssignSuppliers() {
  await requireWarehouse();
  const refs = await getAppSupplierRefsCached();
  return refs.map((s) => ({
    id: s.id,
    name: s.name,
    subiektKhId: s.subiektKhId ?? null,
  }));
}

export type DeliveryJournalPayload = {
  date: string;
  receipts: WarehouseDeliveryReceipt[];
  summary: { receiptCount: number; packageCount: number; palletCount: number };
};

async function buildDeliveryJournalForDate(date: string): Promise<DeliveryJournalPayload> {
  assertJournalDateReadable(date);
  const [receipts, summary] = await Promise.all([
    fetchDeliveryReceiptsForDate(date),
    summarizeDeliveryReceiptsForDate(date),
  ]);
  return { date, receipts, summary };
}

export async function actionFetchTodayDeliveryJournal(): Promise<DeliveryJournalPayload> {
  await requireWarehouse();
  return buildDeliveryJournalForDate(warsawTodayDateKey());
}

export async function actionFetchDeliveryJournalForDate(
  date: string
): Promise<DeliveryJournalPayload> {
  await requireWarehouse();
  return buildDeliveryJournalForDate(date);
}

export async function actionListDeliveryJournalDates(): Promise<string[]> {
  await requireWarehouse();
  return fetchDeliveryDatesWithEntries(31);
}

export async function actionSearchDeliveryJournal(
  filters: DeliveryJournalSearchFilters
) {
  await requireWarehouse();
  const receipts = await searchDeliveryReceipts(filters);
  return { receipts };
}

export async function actionSummarizeDeliveryJournal(
  filters: DeliveryJournalSearchFilters
): Promise<DeliveryJournalRangeSummary> {
  await requireWarehouse();
  return summarizeDeliveryReceiptsRange(filters);
}

export async function actionFetchCarrierHintForSupplier(supplierId: string) {
  await requireWarehouse();
  return fetchCarrierHintForSupplier(supplierId);
}

export async function actionCreateDeliveryReceipt(input: {
  supplierId: string | null;
  supplierLabel?: string;
  carrier: string;
  shipmentForm: string;
  packageCount: number;
  palletCount: number;
  note?: string;
}) {
  const user = await requireWarehouse("mutate");
  const carrier = parseWarehouseCarrier(input.carrier);
  const shipmentForm = parseWarehouseShipmentForm(input.shipmentForm);
  const receipt = await createDeliveryReceipt({
    receivedDate: warsawTodayDateKey(),
    supplierId: input.supplierId,
    supplierLabel: input.supplierLabel,
    carrier,
    shipmentForm,
    packageCount: input.packageCount,
    palletCount: input.palletCount,
    note: input.note,
    createdBy: user.id,
  });
  revalidatePath("/kolejka");
  return receipt;
}

export async function actionUpdateDeliveryReceipt(input: {
  id: string;
  supplierId: string | null;
  supplierLabel?: string;
  carrier: string;
  shipmentForm: string;
  packageCount: number;
  palletCount: number;
  note?: string;
}) {
  const user = await requireWarehouse("mutate");
  const carrier = parseWarehouseCarrier(input.carrier);
  const shipmentForm = parseWarehouseShipmentForm(input.shipmentForm);
  const receipt = await updateDeliveryReceipt({
    id: input.id,
    receivedDate: warsawTodayDateKey(),
    supplierId: input.supplierId,
    supplierLabel: input.supplierLabel,
    carrier,
    shipmentForm,
    packageCount: input.packageCount,
    palletCount: input.palletCount,
    note: input.note,
    updatedBy: user.id,
  });
  revalidatePath("/kolejka");
  return receipt;
}

export async function actionDeleteDeliveryReceipt(id: string) {
  await requireWarehouse("mutate");
  await deleteDeliveryReceipt(id);
  revalidatePath("/kolejka");
  return { success: true as const };
}
