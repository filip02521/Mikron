import { describe, expect, it } from "vitest";
import {
  estimateDeliveryEta,
  formatEtaLabel,
  formatSupplierLeadTimeBrief,
  isPastExpectedDate,
} from "@/lib/orders/delivery-eta";
import type { DeliveryStats } from "@/types/database";
import { parseDateOnly } from "@/lib/orders/dates";

const sameDayStats: DeliveryStats = {
  supplier_id: "x",
  main_sum: 0,
  main_count: 4,
  main_avg: 0,
  side_sum: null,
  side_count: null,
  side_avg: null,
};

const normalStats: DeliveryStats = {
  supplier_id: "x",
  main_sum: 20,
  main_count: 4,
  main_avg: 5,
  side_sum: null,
  side_count: null,
  side_avg: null,
};

describe("estimateDeliveryEta avg===0", () => {
  it("zwraca ETA przy avg=0 (same-day)", () => {
    const eta = estimateDeliveryEta(
      "2026-03-10T10:00:00.000Z",
      sameDayStats,
      "Glowne",
      "LACZNIE",
      { useP50: false }
    );
    expect(eta).not.toBeNull();
    expect(eta!.avgBusinessDays).toBe(0);
    expect(eta!.sameDay).toBe(true);
    expect(formatEtaLabel(eta!).includes("tego samego dnia")).toBe(true);
  });

  it("D+0 okna: zamówienie dziś + avg=0 → nie overdue", () => {
    const todayKey = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Europe/Warsaw",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date());
    const eta = estimateDeliveryEta(
      `${todayKey}T12:00:00`,
      sameDayStats,
      "Glowne",
      "OSOBNO",
      { useP50: false }
    );
    expect(eta).not.toBeNull();
    expect(isPastExpectedDate(eta!.expectedDate)).toBe(false);
  });

  it("D+2: zamówienie sprzed 2 dni roboczych + avg=0 → overdue", () => {
    const eta = estimateDeliveryEta(
      "2020-01-02T12:00:00",
      sameDayStats,
      "Glowne",
      "OSOBNO",
      { useP50: false }
    );
    expect(eta).not.toBeNull();
    expect(isPastExpectedDate(eta!.expectedDate)).toBe(true);
  });

  it("p50 za flagą staje się primary expectedDate", () => {
    const eta = estimateDeliveryEta(
      "2026-03-10T12:00:00",
      normalStats,
      "Glowne",
      "LACZNIE",
      { useP50: true, p50BusinessDays: 3 }
    );
    expect(eta).not.toBeNull();
    expect(eta!.avgBusinessDays).toBe(5);
    expect(eta!.primaryBusinessDays).toBe(3);
    expect(formatEtaLabel(eta!)).toContain("~3 dni rob.");
    expect(formatEtaLabel(eta!)).not.toContain("~5 dni rob.");
    const expected = parseDateOnly("2026-03-13");
    // 10 Mar 2026 is Tue → +3 business days = Fri 13
    expect(eta!.expectedDate.getTime()).toBe(expected!.getTime());
  });
});

describe("formatSupplierLeadTimeBrief avg=0", () => {
  it("pokazuje same-day zamiast null", () => {
    expect(formatSupplierLeadTimeBrief(sameDayStats, "LACZNIE", { useP50: false })).toContain(
      "tego samego dnia"
    );
  });

  it("przy p50 pokazuje medianę zamiast średniej", () => {
    expect(
      formatSupplierLeadTimeBrief(normalStats, "LACZNIE", {
        useP50: true,
        p50Combined: 2,
      })
    ).toContain("~2");
  });
});
