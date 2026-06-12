import { describe, expect, it } from "vitest";
import {
  assertJournalSearchRange,
  deliveryJournalPresetRange,
  matchesDeliveryReceiptQuery,
} from "@/lib/warehouse/delivery-journal-insights";
import type { WarehouseDeliveryReceipt } from "@/lib/warehouse/delivery-receipts";

function sampleReceipt(extra: Partial<WarehouseDeliveryReceipt> = {}): WarehouseDeliveryReceipt {
  return {
    id: "r1",
    receivedDate: "2026-05-28",
    supplierId: "s1",
    supplierLabel: "",
    supplierName: "Dentalstore",
    carrier: "dpd",
    shipmentForm: "paczki",
    packageCount: 2,
    palletCount: 0,
    note: "DHL 123456789",
    createdAt: "2026-05-28T10:00:00Z",
    updatedAt: "2026-05-28T10:00:00Z",
    createdBy: "u1",
    ...extra,
  };
}

describe("deliveryJournalPresetRange", () => {
  it("returns single day for today preset", () => {
    const ref = new Date("2026-05-28T10:00:00Z");
    const { dateFrom, dateTo } = deliveryJournalPresetRange("today", ref);
    expect(dateFrom).toBe(dateTo);
    expect(dateFrom).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("week preset starts on Monday", () => {
    const ref = new Date("2026-05-28T10:00:00Z");
    const { dateFrom, dateTo } = deliveryJournalPresetRange("week", ref);
    expect(dateFrom <= dateTo).toBe(true);
    const monday = new Date(`${dateFrom}T12:00:00`);
    expect(monday.getDay()).toBe(1);
  });

  it("last90 preset spans 90 days", () => {
    const ref = new Date("2026-05-28T10:00:00Z");
    const { dateFrom, dateTo } = deliveryJournalPresetRange("last90", ref);
    expect(dateTo).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(dateFrom < dateTo).toBe(true);
  });
});

describe("matchesDeliveryReceiptQuery", () => {
  it("matches note, supplier and carrier", () => {
    const receipt = sampleReceipt();
    expect(matchesDeliveryReceiptQuery(receipt, "123456789")).toBe(true);
    expect(matchesDeliveryReceiptQuery(receipt, "dentalstore")).toBe(true);
    expect(matchesDeliveryReceiptQuery(receipt, "dpd")).toBe(true);
    expect(matchesDeliveryReceiptQuery(receipt, "nie ma")).toBe(false);
  });
});

describe("assertJournalSearchRange", () => {
  it("rejects ranges over 93 days without query", () => {
    expect(() => assertJournalSearchRange("2026-01-01", "2026-05-01")).toThrow(/93/);
  });

  it("allows up to 365 days when searching by package query", () => {
    expect(() =>
      assertJournalSearchRange("2025-06-01", "2026-05-28", { query: "DHL123" })
    ).not.toThrow();
    expect(() =>
      assertJournalSearchRange("2024-01-01", "2026-05-28", { query: "DHL123" })
    ).toThrow(/365/);
  });
});
