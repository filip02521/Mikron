/** Typy i helpery dat dziennika dostaw — bezpieczne dla klienta (bez I/O Supabase). */

import { addDays } from "date-fns";
import { formatDateString, parseDateOnly } from "@/lib/orders/dates";
import { warsawNowParts } from "@/lib/time/warsaw";
import type { WarehouseCarrier, WarehouseShipmentForm } from "@/lib/warehouse/delivery-carriers";

export type WarehouseDeliveryReceipt = {
  id: string;
  receivedDate: string;
  supplierId: string | null;
  supplierLabel: string;
  supplierName: string;
  carrier: WarehouseCarrier;
  shipmentForm: WarehouseShipmentForm;
  packageCount: number;
  palletCount: number;
  note: string;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
};

export type WarehouseDeliveryDaySummary = {
  receiptCount: number;
  packageCount: number;
  palletCount: number;
};

export type WarehouseCarrierHint = {
  carrier: WarehouseCarrier;
  shipmentForm: WarehouseShipmentForm;
  typicalPackageCount: number;
  typicalPalletCount: number;
  useCount: number;
  source: "default" | "learned";
};

export function warsawTodayDateKey(date = new Date()): string {
  return warsawNowParts(date).dateKey;
}

const DATE_KEY_RE = /^\d{4}-\d{2}-\d{2}$/;

export function parseJournalDateKey(value: string): string | null {
  if (!DATE_KEY_RE.test(value)) return null;
  return parseDateOnly(value) ? value : null;
}

export function shiftJournalDateKey(dateKey: string, deltaDays: number): string {
  const parsed = parseJournalDateKey(dateKey);
  if (!parsed) throw new Error("Nieprawidłowa data.");
  return formatDateString(addDays(parseDateOnly(parsed)!, deltaDays));
}

export function assertJournalDateReadable(dateKey: string): void {
  const parsed = parseJournalDateKey(dateKey);
  if (!parsed) throw new Error("Nieprawidłowa data.");
  if (parsed > warsawTodayDateKey()) {
    throw new Error("Nie można przeglądać przyszłych dat.");
  }
}
