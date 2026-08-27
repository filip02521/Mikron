import { describe, expect, it, vi, beforeEach } from "vitest";
import { parseDateOnly, formatDateString, calculateBusinessDate } from "@/lib/orders/dates";
import type { DeliveryEtaEstimate } from "@/lib/orders/delivery-eta";

const scheduleSelect = vi.fn();
const ordersSelect = vi.fn();

vi.mock("@/lib/supabase/admin", () => ({
  hasSupabaseConfig: () => true,
  createAdminClient: () => ({
    from: (table: string) => {
      if (table === "teeth_supplier_schedules") {
        return {
          select: () => ({
            in: (...args: unknown[]) => scheduleSelect(...args),
          }),
        };
      }
      if (table === "individual_orders") {
        return {
          select: () => ({
            eq: () => ({
              in: () => ({
                eq: () => ({
                  not: () => ({
                    order: () => ({
                      limit: (...args: unknown[]) => ordersSelect(...args),
                    }),
                  }),
                }),
              }),
            }),
          }),
        };
      }
      return {};
    },
  }),
}));

import {
  estimateTeethDeliveryEtaBatch,
  resolveTeethDeliveryDate,
  collectOrdersNeedingTeethDeliveryEstimate,
  teethPlacementDateOnly,
} from "@/lib/data/teeth-delivery-eta";
import { warsawDateKeyFromIso } from "@/lib/time/warsaw";

function makeEstimate(dateStr: string, avgDays = 5, sampleCount = 5): DeliveryEtaEstimate {
  return {
    avgBusinessDays: avgDays,
    primaryBusinessDays: avgDays,
    expectedDate: parseDateOnly(dateStr)!,
    sampleCount,
    lowConfidence: sampleCount < 3,
  };
}

describe("resolveTeethDeliveryDate", () => {
  it("zwraca ręczną datę gdy ustawiona", () => {
    const result = resolveTeethDeliveryDate("2026-07-15", makeEstimate("2026-07-10"));
    expect(result).toBe("2026-07-15");
  });

  it("zwraca szacunek gdy brak ręcznej daty", () => {
    const result = resolveTeethDeliveryDate(null, makeEstimate("2026-07-10"));
    expect(result).toBe("2026-07-10");
  });

  it("zwraca null gdy brak ręcznej daty i brak szacunku", () => {
    const result = resolveTeethDeliveryDate(null, null);
    expect(result).toBeNull();
  });

  it("ręczna data ma priorytet nad szacunkiem", () => {
    const result = resolveTeethDeliveryDate("2026-08-01", makeEstimate("2026-07-10"));
    expect(result).toBe("2026-08-01");
  });
});

describe("estimateTeethDeliveryEtaBatch", () => {
  beforeEach(() => {
    scheduleSelect.mockReset();
    ordersSelect.mockReset();
  });

  it("stałe 4 dni → data = placement + 4 dni rob.; historia ignorowana", async () => {
    scheduleSelect.mockResolvedValue({
      data: [{ supplier_id: "ivoclar", delivery_lead_business_days: 4 }],
      error: null,
    });
    ordersSelect.mockResolvedValue({
      data: [
        {
          supplier_id: "ivoclar",
          teeth_ordered_at: "2026-01-01",
          ordered_at: "2026-01-01",
          delivery_at: "2026-01-20",
        },
      ],
      error: null,
    });

    const placement = "2026-03-10T09:00:00+01:00";
    const map = await estimateTeethDeliveryEtaBatch(["ivoclar"], placement);
    const eta = map.get("ivoclar");
    expect(eta?.source).toBe("fixed");
    expect(eta?.avgBusinessDays).toBe(4);
    expect(eta?.sampleCount).toBe(0);
    expect(eta?.lowConfidence).toBe(false);
    expect(formatDateString(eta!.expectedDate)).toBe(
      formatDateString(calculateBusinessDate(parseDateOnly(warsawDateKeyFromIso(placement))!, 4))
    );
    expect(ordersSelect).not.toHaveBeenCalled();
  });

  it("placement ISO blisko północy UTC używa daty warszawskiej", async () => {
    scheduleSelect.mockResolvedValue({
      data: [{ supplier_id: "ivoclar", delivery_lead_business_days: 1 }],
      error: null,
    });
    // 23:30 UTC = 00:30 następnego dnia w Warszawie (CEST w sierpniu)
    const placement = "2026-08-10T23:30:00.000Z";
    const map = await estimateTeethDeliveryEtaBatch(["ivoclar"], placement);
    const eta = map.get("ivoclar");
    expect(formatDateString(eta!.expectedDate)).toBe(
      formatDateString(
        calculateBusinessDate(parseDateOnly(warsawDateKeyFromIso(placement))!, 1)
      )
    );
    expect(warsawDateKeyFromIso(placement)).toBe("2026-08-11");
  });

  it("brak stałego → historia jak dziś", async () => {
    scheduleSelect.mockResolvedValue({
      data: [{ supplier_id: "ivoclar", delivery_lead_business_days: null }],
      error: null,
    });
    ordersSelect.mockResolvedValue({
      data: [
        {
          supplier_id: "ivoclar",
          teeth_ordered_at: "2026-01-05T10:00:00+01:00",
          ordered_at: "2026-01-05T10:00:00+01:00",
          delivery_at: "2026-01-12",
        },
        {
          supplier_id: "ivoclar",
          teeth_ordered_at: "2026-02-02T10:00:00+01:00",
          ordered_at: "2026-02-02T10:00:00+01:00",
          delivery_at: "2026-02-09",
        },
        {
          supplier_id: "ivoclar",
          teeth_ordered_at: "2026-03-02T10:00:00+01:00",
          ordered_at: "2026-03-02T10:00:00+01:00",
          delivery_at: "2026-03-09",
        },
      ],
      error: null,
    });

    const placement = "2026-04-01T09:00:00+02:00";
    const map = await estimateTeethDeliveryEtaBatch(["ivoclar"], placement);
    const eta = map.get("ivoclar");
    expect(eta?.source).toBe("history");
    expect(eta?.avgBusinessDays).toBeGreaterThan(0);
    expect(eta?.sampleCount).toBe(3);
  });

  it("days = 0 / brak wiersza → historia", async () => {
    scheduleSelect.mockResolvedValue({
      data: [{ supplier_id: "a", delivery_lead_business_days: 0 }],
      error: null,
    });
    ordersSelect.mockResolvedValue({ data: [], error: null });

    const map = await estimateTeethDeliveryEtaBatch(["a", "b"], "2026-04-01");
    expect(map.size).toBe(0);
    expect(ordersSelect).toHaveBeenCalled();
  });
});

describe("collectOrdersNeedingTeethDeliveryEstimate", () => {
  const placement = "2026-05-04T10:00:00+02:00";

  it("bierze tylko wiersze z dostawcą i bez teeth_delivery_date", () => {
    const rows = collectOrdersNeedingTeethDeliveryEstimate(
      [
        { id: "1", supplier_id: "s1", teeth_delivery_date: null },
        { id: "2", supplier_id: null, teeth_delivery_date: null },
        { id: "3", supplier_id: "s2", teeth_delivery_date: "2026-05-10" },
        { id: "4", supplier_id: "  s3  ", teeth_delivery_date: null },
      ],
      placement
    );
    expect(rows).toEqual([
      {
        id: "1",
        supplier_id: "s1",
        ordered_at: placement,
        teeth_ordered_at: placement,
      },
      {
        id: "4",
        supplier_id: "s3",
        ordered_at: placement,
        teeth_ordered_at: placement,
      },
    ]);
  });

  it("pusta lista / null → []", () => {
    expect(collectOrdersNeedingTeethDeliveryEstimate(null, placement)).toEqual([]);
    expect(collectOrdersNeedingTeethDeliveryEstimate([], placement)).toEqual([]);
  });
});

describe("teethPlacementDateOnly", () => {
  it("YYYY-MM-DD bez zmian", () => {
    expect(formatDateString(teethPlacementDateOnly("2026-05-04")!)).toBe("2026-05-04");
  });

  it("ISO → klucz daty w Warszawie", () => {
    expect(formatDateString(teethPlacementDateOnly("2026-08-10T23:30:00.000Z")!)).toBe(
      "2026-08-11"
    );
  });
});
