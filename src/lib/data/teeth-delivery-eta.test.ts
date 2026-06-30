import { describe, expect, it } from "vitest";
import { resolveTeethDeliveryDate } from "@/lib/data/teeth-delivery-eta";
import { parseDateOnly } from "@/lib/orders/dates";
import type { DeliveryEtaEstimate } from "@/lib/orders/delivery-eta";

function makeEstimate(dateStr: string, avgDays = 5, sampleCount = 5): DeliveryEtaEstimate {
  return {
    avgBusinessDays: avgDays,
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
