import { describe, expect, it } from "vitest";
import {
  buildTeethSupplierBatchSummary,
  mergeTeethGroupedDetails,
} from "./teeth-panel-aggregate";

describe("mergeTeethGroupedDetails", () => {
  it("sums counts for identical specs across orders", () => {
    const merged = mergeTeethGroupedDetails([
      [{ color: "A2", mould: "N12", jaw: "upper", kind: "anterior", count: 2 }],
      [{ color: "A2", mould: "N12", jaw: "upper", kind: "anterior", count: 1 }],
      [{ color: "B1", mould: null, jaw: "lower", kind: null, count: 1 }],
    ]);
    expect(merged).toHaveLength(2);
    expect(merged.find((g) => g.color === "A2")?.count).toBe(3);
    expect(merged.find((g) => g.color === "B1")?.count).toBe(1);
  });
});

describe("buildTeethSupplierBatchSummary", () => {
  it("aggregates multiple orders and tracks missing specs", () => {
    const batch = buildTeethSupplierBatchSummary([
      {
        id: "o1",
        products: "Phonares",
        quantity: "2",
        sales_person_name: "Jan",
        teeth_details: [
          { id: "1", order_id: "o1", position: 1, color: "A2", mould: "N1", size: null, jaw: "upper", kind: "anterior" },
          { id: "2", order_id: "o1", position: 2, color: "A2", mould: "N1", size: null, jaw: "upper", kind: "anterior" },
        ],
      },
      {
        id: "o2",
        products: "Wiedent",
        quantity: "1",
        sales_person_name: "Anna",
        teeth_details: [
          { id: "3", order_id: "o2", position: 1, color: "A2", mould: "N1", size: null, jaw: "upper", kind: "anterior" },
        ],
      },
      {
        id: "o3",
        products: "Major",
        quantity: "1",
        sales_person_name: "Piotr",
        teeth_details: null,
      },
    ]);

    expect(batch.orderCount).toBe(3);
    expect(batch.ordersWithSpec).toBe(2);
    expect(batch.ordersMissingSpec).toBe(1);
    expect(batch.totalPieces).toBe(3);
    expect(batch.mergedGroups).toHaveLength(1);
    expect(batch.mergedGroups[0]?.count).toBe(3);
    expect(batch.byOrder).toHaveLength(3);
  });
});
