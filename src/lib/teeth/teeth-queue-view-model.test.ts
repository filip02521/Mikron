import { describe, expect, it } from "vitest";
import type { TeethQueueItem } from "@/lib/data/teeth-queue-shared";
import {
  aggregateTeethSupplierOrder,
  formatTeethAggregateForClipboard,
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
