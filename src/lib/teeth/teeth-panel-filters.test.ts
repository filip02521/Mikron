import { describe, expect, it } from "vitest";
import {
  extractTeethFilterOptions,
  filterTeethHistoryGroups,
  filterTeethQueueGroups,
  mergeTeethFilterOptionGroups,
  mergeTeethFilterOptions,
  orderHasTeethSpec,
  teethQueueStatsBySupplier,
} from "./teeth-panel-filters";
import type { TeethQueueGroup } from "@/lib/data/teeth-queue";

const sampleGroup: TeethQueueGroup = {
  supplierId: "sup-1",
  supplierName: "Mikran",
  scheduledOnly: false,
  items: [
    {
      id: "o1",
      products: "Phonares",
      quantity: "2",
      status: "Nowe",
      supplier_id: "sup-1",
      sales_person_id: "sp1",
      sales_person_name: "Jan",
      supplier_name: "Mikran",
      symbol: "PH",
      teeth_details: [
        {
          id: "t1",
          order_id: "o1",
          position: 1,
          color: "A2",
          mould: null,
          size: null,
          jaw: "upper",
          kind: "anterior",
        },
      ],
    } as TeethQueueGroup["items"][number],
    {
      id: "o2",
      products: "Major",
      quantity: "1",
      status: "Nowe",
      sales_person_id: "sp2",
      sales_person_name: "Anna",
      supplier_id: null,
      supplier_name: "Mikran",
      symbol: "-",
      teeth_details: null,
    } as TeethQueueGroup["items"][number],
  ],
};

describe("orderHasTeethSpec", () => {
  const completeRow = {
    id: "t1",
    order_id: "o1",
    position: 1,
    color: "A2",
    mould: "N1",
    size: null,
    jaw: "upper" as const,
    kind: "anterior" as const,
  };

  it("returns true when every row has color, jaw and kind", () => {
    expect(orderHasTeethSpec({ teeth_details: [completeRow] })).toBe(true);
  });

  it("returns false when jaw is missing", () => {
    expect(
      orderHasTeethSpec({
        teeth_details: [{ ...completeRow, jaw: null }],
      })
    ).toBe(false);
  });

  it("returns false when empty or null", () => {
    expect(orderHasTeethSpec({ teeth_details: [] })).toBe(false);
    expect(orderHasTeethSpec({ teeth_details: null })).toBe(false);
  });
});

describe("filterTeethQueueGroups", () => {
  it("filters missing spec and incomplete header data", () => {
    const missingOnly = filterTeethQueueGroups([sampleGroup], {
      supplierId: null,
      salesPersonId: null,
      missingSpecOnly: true,
      verificationOnly: false,
    });
    expect(missingOnly[0]?.items).toHaveLength(1);
    expect((missingOnly[0]?.items[0] as { id: string }).id).toBe("o2");

    const headerOnly = filterTeethQueueGroups([sampleGroup], {
      supplierId: null,
      salesPersonId: null,
      missingSpecOnly: false,
      verificationOnly: true,
    });
    expect(headerOnly[0]?.items).toHaveLength(1);
    expect((headerOnly[0]?.items[0] as { id: string }).id).toBe("o2");
  });
});

describe("filterTeethHistoryGroups", () => {
  it("ignoruje filtry kolejki (specyfikacja, dane ogólne)", () => {
    const historyGroup: TeethQueueGroup = {
      ...sampleGroup,
      items: sampleGroup.items.map((item) => ({
        ...item,
        status: "Zamowione",
      })),
    };
    const filtered = filterTeethHistoryGroups([historyGroup], {
      supplierId: null,
      salesPersonId: null,
      missingSpecOnly: true,
      verificationOnly: true,
    });
    expect(filtered[0]?.items).toHaveLength(2);
  });
});

describe("teethQueueStatsBySupplier", () => {
  it("counts pending and missing spec per supplier", () => {
    const map = teethQueueStatsBySupplier([sampleGroup]);
    expect(map.get("sup-1")).toEqual({ pendingCount: 2, missingSpecCount: 1 });
  });
});

describe("mergeTeethFilterOptions", () => {
  it("merges suppliers and sales people from queue and history", () => {
    const historyGroup: TeethQueueGroup = {
      supplierId: "sup-2",
      supplierName: "Wiedent",
      scheduledOnly: false,
      items: [
        {
          id: "h1",
          products: "Estetic",
          status: "Zamowione",
          sales_person_id: "sp3",
          sales_person_name: "Piotr",
          supplier_id: "sup-2",
          supplier_name: "Wiedent",
        } as TeethQueueGroup["items"][number],
      ],
    };
    const merged = mergeTeethFilterOptions(
      extractTeethFilterOptions([sampleGroup]),
      extractTeethFilterOptions([historyGroup]),
    );
    expect(merged.suppliers.map((s) => s.id).sort()).toEqual(["sup-1", "sup-2"]);
    expect(merged.salesPeople.map((s) => s.id).sort()).toEqual(["sp1", "sp2", "sp3"]);
  });
});

describe("mergeTeethFilterOptionGroups", () => {
  it("skips entries without items array", () => {
    const merged = mergeTeethFilterOptionGroups(
      [sampleGroup],
      [{ supplierId: "x", supplierName: "Bad", scheduledOnly: false, items: null as never }],
    );
    expect(merged).toHaveLength(1);
    expect(merged[0]?.supplierId).toBe("sup-1");
  });
});
