import { describe, expect, it } from "vitest";
import {
  aggregateDeliveryStatsFromSampleRows,
  importProtectedStatsFromSampleRows,
  mergeAggregatedPreferLive,
  quantilesFromSampleRows,
  selectSamplesForStats,
  type DeliveryStatsSampleRow,
} from "@/lib/orders/delivery-stats-samples";

function sample(
  partial: Partial<DeliveryStatsSampleRow> &
    Pick<DeliveryStatsSampleRow, "supplier_id" | "business_days_full" | "order_type">
): DeliveryStatsSampleRow {
  return {
    order_id: partial.order_id ?? null,
    placement_date: partial.placement_date ?? "2026-03-10",
    delivery_date: partial.delivery_date ?? "2026-03-12",
    is_teeth: false,
    source: "receive",
    deleted_at: null,
    ...partial,
  };
}

describe("aggregateDeliveryStatsFromSampleRows", () => {
  it("waży mean po dniu+typ (wiele SKU tego samego dnia = 1 waga)", () => {
    const by = aggregateDeliveryStatsFromSampleRows([
      sample({
        supplier_id: "s1",
        order_id: "a",
        business_days_full: 1,
        order_type: "Glowne",
        placement_date: "2026-03-10",
      }),
      sample({
        supplier_id: "s1",
        order_id: "b",
        business_days_full: 5,
        order_type: "Glowne",
        placement_date: "2026-03-10",
      }),
      sample({
        supplier_id: "s1",
        order_id: "c",
        business_days_full: 3,
        order_type: "Glowne",
        placement_date: "2026-03-11",
      }),
    ]);
    const agg = by.get("s1")!;
    // day1 mean=(1+5)/2=3, day2=3 → avg=3, count=2
    expect(agg.main_count).toBe(2);
    expect(agg.main_avg).toBe(3);
  });

  it("import nie miesza się z live mean; merge preferuje live", () => {
    const live = aggregateDeliveryStatsFromSampleRows([
      sample({
        supplier_id: "s1",
        business_days_full: 4,
        order_type: "Glowne",
        source: "receive",
      }),
    ]);
    const imported = importProtectedStatsFromSampleRows([
      sample({
        supplier_id: "s1",
        business_days_full: 10,
        order_type: "Glowne",
        source: "import",
      }),
      sample({
        supplier_id: "s2",
        business_days_full: 7,
        order_type: "Glowne",
        source: "import",
      }),
    ]);
    const merged = mergeAggregatedPreferLive(live, imported);
    expect(merged.get("s1")!.main_avg).toBe(4);
    expect(merged.get("s2")!.main_avg).toBe(7);
  });
});

describe("quantilesFromSampleRows", () => {
  it("liczy p50/p90 z próbek orderów", () => {
    const rows = [1, 2, 3, 4, 10].map((d, i) =>
      sample({
        supplier_id: "s1",
        order_id: `o${i}`,
        business_days_full: d,
        order_type: "Glowne",
        delivery_date: "2026-06-01",
      })
    );
    const q = quantilesFromSampleRows(rows, "Glowne", "OSOBNO", {
      now: new Date("2026-06-15"),
    });
    expect(q.nOrders).toBe(5);
    expect(q.p50).toBe(3);
    expect(q.p90).toBe(10);
    expect(q.variability).toBe("wide");
  });
});

describe("selectSamplesForStats", () => {
  const now = new Date("2026-10-03T12:00:00Z");
  const row = (
    supplier_id: string,
    source: DeliveryStatsSampleRow["source"],
    placement_date: string
  ): DeliveryStatsSampleRow => ({
    supplier_id,
    order_id: null,
    placement_date,
    delivery_date: placement_date,
    business_days_full: 2,
    order_type: "Glowne",
    is_teeth: false,
    source,
  });

  it("dostawca z ZD → FZ w oknie 24 mies.: tylko Subiekt, bez kliknięć z panelu", () => {
    const rows = [
      ...["2026-01-05", "2026-02-05", "2026-03-05", "2026-04-05", "2026-05-05"].map((d) =>
        row("a", "subiekt", d)
      ),
      row("a", "subiekt", "2015-01-05"),
      row("a", "receive", "2026-06-01"),
    ];
    const picked = selectSamplesForStats(rows, now);
    expect(picked.every((r) => r.source === "subiekt")).toBe(true);
    expect(picked).toHaveLength(5); // stara historia poza oknem odpada
  });

  it("mało zamówień w oknie → dobiera najnowsze starsze do minimum", () => {
    const rows = ["2026-05-05", "2019-01-01", "2018-01-01", "2017-01-01", "2016-01-01", "2010-01-01"].map(
      (d) => row("a", "subiekt", d)
    );
    expect(selectSamplesForStats(rows, now).map((r) => r.placement_date)).toEqual([
      "2026-05-05",
      "2019-01-01",
      "2018-01-01",
      "2017-01-01",
      "2016-01-01",
    ]);
  });

  it("Subiekt tylko z dawną historią, a panel ma pomiary → zostają pomiary z panelu", () => {
    const rows = [row("a", "subiekt", "2015-01-05"), row("a", "receive", "2026-06-01"), row("b", "backfill", "2026-01-01")];
    expect(selectSamplesForStats(rows, now).map((r) => `${r.supplier_id}:${r.source}`)).toEqual([
      "a:receive",
      "b:backfill",
    ]);
  });
});
