import { describe, expect, it } from "vitest";
import type { TeethQueueItem } from "@/lib/data/teeth-queue-shared";
import {
  aggregateTeethSupplierOrder,
  aggregateTeethSupplierOrderByLine,
  buildTeethMarkPlan,
  teethSelectionsForItems,
  formatTeethAggregateForClipboard,
  formatTeethAggregateSectionsForClipboard,
  groupTeethQueueByProductLine,
  TEETH_UNKNOWN_LINE_LABEL,
  formatTeethSpecLabel,
  teethOrderSpecLines,
  teethOrderUnorderedPositions,
} from "@/lib/teeth/teeth-queue-view-model";

type Detail = NonNullable<TeethQueueItem["teeth_details"]>[number];

function detail(position: number, over: Partial<Detail> = {}): Detail {
  return {
    id: `d${position}`,
    order_id: "o",
    position,
    color: "A2",
    mould: "N5U",
    size: null,
    jaw: "upper",
    kind: "posterior",
    ordered_at: null,
    created_at: "2026-09-01T00:00:00Z",
    ...over,
  } as Detail;
}

function item(id: string, details: Detail[]): TeethQueueItem {
  return { id, teeth_details: details } as unknown as TeethQueueItem;
}

describe("teethOrderSpecLines", () => {
  it("sumuje identyczne zęby i oddziela zamówione", () => {
    const lines = teethOrderSpecLines(
      item("a", [
        detail(1),
        detail(2, { ordered_at: "2026-09-02T00:00:00Z" }),
        detail(3, { color: "B1", mould: "S42", jaw: null, kind: "anterior" }),
      ]),
    );
    expect(lines).toHaveLength(2);
    const posterior = lines.find((l) => l.color === "A2")!;
    expect(posterior.total).toBe(2);
    expect(posterior.orderedCount).toBe(1);
    expect(posterior.unorderedPositions).toEqual([1]);
  });

  it("zwraca pozycje niezamówione", () => {
    expect(
      teethOrderUnorderedPositions(
        item("a", [detail(1), detail(2, { ordered_at: "2026-09-02T00:00:00Z" })]),
      ),
    ).toEqual([1]);
  });
});

describe("formatTeethSpecLabel", () => {
  it("pomija szczękę dla przednich i gdy fason ją koduje", () => {
    expect(formatTeethSpecLabel({ color: "B1", mould: "S42", jaw: "upper", kind: "anterior" })).toBe(
      "B1 · S42 · przednie",
    );
    expect(formatTeethSpecLabel({ color: "A2", mould: "N5U", jaw: "upper", kind: "posterior" })).toBe(
      "A2 · N5U · boczne",
    );
    expect(formatTeethSpecLabel({ color: "A2", mould: "32", jaw: "lower", kind: "posterior" })).toBe(
      "A2 · 32 · dół · boczne",
    );
  });
});

describe("aggregateTeethSupplierOrder", () => {
  it("sumuje niezamówione zęby ze wszystkich próśb", () => {
    const lines = aggregateTeethSupplierOrder([
      item("a", [detail(1), detail(2)]),
      item("b", [detail(1), detail(2, { ordered_at: "2026-09-02T00:00:00Z" })]),
      item("c", [detail(1, { color: "B1", mould: "S42", jaw: null, kind: "anterior" })]),
    ]);
    expect(lines).toHaveLength(2);
    const a2 = lines.find((l) => l.color === "A2")!;
    expect(a2.quantity).toBe(3);
    expect(a2.orderCount).toBe(2);
    expect(lines[0]!.kind).toBe("anterior");
  });

  it("formatuje zestawienie do schowka", () => {
    const text = formatTeethAggregateForClipboard(
      "Ivoclar",
      aggregateTeethSupplierOrder([item("a", [detail(1), detail(2)])]),
    );
    expect(text).toContain("Zamówienie zębów — Ivoclar");
    expect(text).toContain("A2\tN5U\t—\tboczne\t2 szt.");
    expect(text).toContain("Razem: 2 szt.");
  });
});

function productItem(id: string, products: string, details: Detail[]): TeethQueueItem {
  return { id, products, teeth_details: details } as unknown as TeethQueueItem;
}

describe("groupTeethQueueByProductLine", () => {
  it("dzieli prośby na linie w kolejności katalogu, nierozpoznane na końcu", () => {
    const sections = groupTeethQueueByProductLine([
      productItem("x", "Coś innego", [detail(1)]),
      productItem("v", "Ivoclar Vivodent DCL przednie", [detail(1)]),
      productItem("p", "Ivoclar Phonares II boczne", [detail(1)]),
      productItem("p2", "Ivoclar Phonares II przednie", [detail(1)]),
    ]);
    expect(sections.map((s) => s.productLine)).toEqual([
      "ivoclar_phonares_ii",
      "ivoclar_vivodent_dcl",
      null,
    ]);
    expect(sections[0]!.items.map((i) => i.id)).toEqual(["p", "p2"]);
    expect(sections[2]!.label).toBe(TEETH_UNKNOWN_LINE_LABEL);
  });
});

describe("aggregateTeethSupplierOrderByLine", () => {
  it("nie łączy tego samego koloru z różnych linii", () => {
    const sections = aggregateTeethSupplierOrderByLine([
      productItem("p", "Ivoclar Phonares II boczne", [detail(1), detail(2)]),
      productItem("v", "Ivoclar Vivodent DCL boczne", [detail(1)]),
    ]);
    expect(sections).toHaveLength(2);
    expect(sections.map((s) => s.total)).toEqual([2, 1]);
    const text = formatTeethAggregateSectionsForClipboard("Ivoclar", sections);
    expect(text).toContain(`${sections[0]!.label} (2 szt.)`);
    expect(text).toContain(`${sections[1]!.label} (1 szt.)`);
    expect(text).toContain("Razem: 3 szt.");
  });
});

function supplierItem(id: string, supplierId: string, details: Detail[]): TeethQueueItem {
  return {
    id,
    supplier_id: supplierId,
    sales_person_name: "Magda",
    products: "Ivoclar Phonares II boczne",
    teeth_details: details,
  } as unknown as TeethQueueItem;
}

describe("teethSelectionsForItems", () => {
  it("bierze tylko zaznaczone i niezamówione pozycje tego dostawcy", () => {
    const items = [
      supplierItem("a", "s1", [detail(1), detail(2), detail(3, { ordered_at: "2026-09-02T00:00:00Z" })]),
      supplierItem("b", "s1", [detail(1)]),
    ];
    const sel = new Map([
      ["a", new Set([1, 3])],
      ["other", new Set([1])],
    ]);
    expect(teethSelectionsForItems(items, sel)).toEqual([{ orderId: "a", positions: [1] }]);
  });
});

describe("buildTeethMarkPlan", () => {
  const a = supplierItem("a", "s1", [detail(1), detail(2), detail(3)]);
  const b = supplierItem("b", "s1", [detail(1), detail(2)]);
  const c = supplierItem("c", "s2", [detail(1)]);
  const byId = new Map([a, b, c].map((i) => [i.id, i]));

  it("przy częściowym zaznaczeniu liczy, ile zostaje w kolejce u dostawcy", () => {
    const plan = buildTeethMarkPlan([{ orderId: "a", positions: [1, 2] }], byId, new Set(["a", "b"]));
    expect(plan.markCount).toBe(2);
    expect(plan.leftInQueue).toBe(3);
    expect(plan.rows[0]).toMatchObject({ orderId: "a", marking: 2, open: 3 });
  });

  it("pomija prośby niegotowe i pozycje już zamówione", () => {
    const plan = buildTeethMarkPlan(
      [
        { orderId: "a", positions: [1, 2, 3, 99] },
        { orderId: "b", positions: [1, 2] },
      ],
      byId,
      new Set(["a"]),
    );
    expect(plan.markCount).toBe(3);
    expect(plan.rows.map((r) => r.orderId)).toEqual(["a"]);
    expect(plan.leftInQueue).toBe(2);
  });
});
