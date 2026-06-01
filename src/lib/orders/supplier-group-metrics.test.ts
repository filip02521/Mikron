import { describe, expect, it } from "vitest";
import {
  buildSupplierGroupMetrics,
  formatSupplierGroupHeaderSummary,
} from "./supplier-group-metrics";
import { testIndividualOrder } from "@/test-utils/fixtures";

function order(partial: Parameters<typeof testIndividualOrder>[0]) {
  return testIndividualOrder({
    quantity: "10",
    delivered_quantity: "2",
    status: "Zamowione",
    action_at: "",
    supplier: { name: "DFS" } as never,
    ...partial,
  });
}

describe("supplier group metrics", () => {
  it("łączy kolejkę i regał", () => {
    const m = buildSupplierGroupMetrics(
      [order({ id: "1", status: "Czesciowo_zrealizowane" }), order({ id: "2" })],
      [order({ id: "3", status: "Zrealizowane" })]
    );
    expect(m.get("DFS")).toEqual({ queue: 2, shelf: 1, partial: 1 });
  });

  it("formatuje podsumowanie z widocznej grupy", () => {
    const summary = formatSupplierGroupHeaderSummary(
      [
        order({ id: "1", status: "Czesciowo_zrealizowane" }),
        order({ id: "2" }),
      ],
      { queue: 4, shelf: 2, partial: 99 }
    );
    expect(summary).toContain("2 poz.");
    expect(summary).toContain("1 częściowo");
    expect(summary).toContain("na regale");
    expect(summary).not.toContain("99 częściowo");
  });
});
