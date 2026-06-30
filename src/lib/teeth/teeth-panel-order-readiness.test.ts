import { describe, expect, it } from "vitest";
import { orderTeethListReadyForOrder } from "./teeth-panel-order-readiness";
import type { TeethProductInfoLookup } from "./teeth-validation";

const wiedentEsteticInfo: TeethProductInfoLookup = {
  productLine: "wiedent_estetic",
  manufacturer: "wiedent",
  kind: "anterior",
};

describe("orderTeethListReadyForOrder", () => {
  const ctx = {
    teethInfoByTwId: new Map<number, TeethProductInfoLookup>([[100, wiedentEsteticInfo]]),
  };

  it("returns false when list is empty", () => {
    expect(orderTeethListReadyForOrder({ teeth_details: null }, ctx)).toBe(false);
    expect(orderTeethListReadyForOrder({ teeth_details: [] }, ctx)).toBe(false);
  });

  it("requires mould when catalog requires it", () => {
    expect(
      orderTeethListReadyForOrder(
        {
          subiekt_tw_id: 100,
          products: "Wiedent Estetic",
          teeth_details: [
            {
              id: "1",
              order_id: "o1",
              position: 1,
              color: "A2",
              mould: null,
              size: null,
              jaw: "upper",
              kind: "anterior",
            },
          ],
        },
        ctx,
      ),
    ).toBe(false);

    expect(
      orderTeethListReadyForOrder(
        {
          subiekt_tw_id: 100,
          products: "Wiedent Estetic",
          teeth_details: [
            {
              id: "1",
              order_id: "o1",
              position: 1,
              color: "A2",
              mould: "12",
              size: null,
              jaw: "upper",
              kind: "anterior",
            },
          ],
        },
        ctx,
      ),
    ).toBe(true);
  });

  it("falls back to minimal rules without catalog context", () => {
    expect(
      orderTeethListReadyForOrder({
        teeth_details: [
          {
            id: "1",
            order_id: "o1",
            position: 1,
            color: "A2",
            mould: null,
            size: null,
            jaw: "upper",
            kind: "anterior",
          },
        ],
      }),
    ).toBe(true);
  });
});
