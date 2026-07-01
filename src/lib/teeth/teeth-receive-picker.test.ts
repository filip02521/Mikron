import { describe, expect, it } from "vitest";
import {
  computeTeethReceiveSessionSum,
  computeTeethReceiveTotalToSave,
  setTeethReceiveLineQty,
  teethReceiveDeliveredAllocationByGroup,
  teethReceiveFillAllSession,
  teethReceiveFillSession,
  teethReceiveFifoAllocation,
  teethReceiveGroupKey,
} from "./teeth-receive-picker";
import type { IndividualOrder } from "@/types/database";
import type { TeethGroupedDetail } from "@/lib/teeth/teeth-catalog";

const groups: TeethGroupedDetail[] = [
  { color: "A1", mould: "W1", jaw: "upper", kind: "anterior", count: 3 },
  { color: "A2", mould: "W2", jaw: "lower", kind: "posterior", count: 2 },
];

function order(partial: Partial<IndividualOrder> = {}): IndividualOrder {
  return {
    id: "o1",
    quantity: "5",
    delivered_quantity: null,
    ...partial,
  } as IndividualOrder;
}

describe("teeth-receive-picker", () => {
  it("sumuje ilości z wierszy specyfikacji", () => {
    const lineQty = {
      [teethReceiveGroupKey(groups[0]!)]: "2",
      [teethReceiveGroupKey(groups[1]!)]: "1",
    };
    expect(computeTeethReceiveSessionSum(groups, lineQty)).toBe(3);
    expect(computeTeethReceiveTotalToSave(order(), groups, lineQty)).toBe(3);
  });

  it("dodaje sesję do już przyjętej ilości", () => {
    const lineQty = { [teethReceiveGroupKey(groups[0]!)]: "1" };
    expect(
      computeTeethReceiveTotalToSave(order({ delivered_quantity: "2" }), groups, lineQty),
    ).toBe(3);
  });

  it("ogranicza wiersz do pozostałej ilości zamówienia", () => {
    const next = setTeethReceiveLineQty(groups, {}, teethReceiveGroupKey(groups[0]!), "9", 2);
    expect(next[teethReceiveGroupKey(groups[0]!)]).toBe("2");
  });

  it("fill session rozdziela pozostałą ilość", () => {
    expect(teethReceiveFillSession(groups, 4)).toEqual({
      [teethReceiveGroupKey(groups[0]!)]: "3",
      [teethReceiveGroupKey(groups[1]!)]: "1",
    });
  });

  it("fill all ustawia pełne ilości grup", () => {
    expect(teethReceiveFillAllSession(groups)).toEqual({
      [teethReceiveGroupKey(groups[0]!)]: "3",
      [teethReceiveGroupKey(groups[1]!)]: "2",
    });
  });

  it("FIFO alokuje delivered_quantity po grupach", () => {
    const alloc = teethReceiveFifoAllocation(order({ delivered_quantity: "4" }), groups);
    expect(alloc[teethReceiveGroupKey(groups[0]!)]).toBe(3);
    expect(alloc[teethReceiveGroupKey(groups[1]!)]).toBe(1);

    const stored = teethReceiveDeliveredAllocationByGroup(
      order({
        delivered_quantity: "4",
        teeth_line_delivered: { [teethReceiveGroupKey(groups[1]!)]: 2 },
      }),
      groups,
    );
    expect(stored[teethReceiveGroupKey(groups[1]!)]).toBe(2);
    expect(stored[teethReceiveGroupKey(groups[0]!)]).toBeUndefined();
  });

  it("fill session pomija linie już kompletne", () => {
    const lineAlready = { [teethReceiveGroupKey(groups[0]!)]: 3 };
    expect(teethReceiveFillSession(groups, 2, lineAlready)).toEqual({
      [teethReceiveGroupKey(groups[1]!)]: "2",
    });
  });
});
