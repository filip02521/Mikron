import { describe, expect, it } from "vitest";
import {
  orderTeethListReadyForOrder,
  resolveTeethProductLineForPanelOrder,
  teethPanelProductLineLabelForOrder,
  distinctTeethProductLineLabelsForOrders,
  teethPanelReadinessContextFromMaps,
} from "./teeth-panel-order-readiness";
import type { TeethProductInfoLookup } from "./teeth-validation";

const wiedentEsteticInfo: TeethProductInfoLookup = {
  productLine: "wiedent_estetic",
  manufacturer: "wiedent",
  kind: "anterior",
};

describe("resolveTeethProductLineForPanelOrder", () => {
  const ctx = teethPanelReadinessContextFromMaps({
    productLineByTwId: new Map([[100, "wiedent_estetic"]]),
    manufacturerByTwId: new Map([[100, "wiedent"]]),
    kindByTwId: new Map([[100, "anterior"]]),
  });

  it("prefers Vita line from product name over generic admin estetic", () => {
    expect(
      resolveTeethProductLineForPanelOrder(
        { subiekt_tw_id: 100, products: "Wiedent Vita zęby przody" },
        ctx,
      ),
    ).toBe("wiedent_estetic_vita");
    expect(
      teethPanelProductLineLabelForOrder(
        { subiekt_tw_id: 100, products: "Wiedent Vita zęby przody" },
        ctx,
      ),
    ).toBe("Wiedent Estetic wg Vity");
  });

  it("collects distinct line labels in supplier group", () => {
    const labels = distinctTeethProductLineLabelsForOrders(
      [
        { subiekt_tw_id: 100, products: "Wiedent Vita zęby przody" },
        { subiekt_tw_id: 101, products: "Wiedent Estetic skala W przody" },
      ],
      teethPanelReadinessContextFromMaps({
        productLineByTwId: new Map([
          [100, "wiedent_estetic"],
          [101, "wiedent_estetic"],
        ]),
        manufacturerByTwId: new Map([
          [100, "wiedent"],
          [101, "wiedent"],
        ]),
        kindByTwId: new Map([
          [100, "anterior"],
          [101, "anterior"],
        ]),
      }),
    );
    expect(labels).toEqual(["Wiedent Estetic wg Vity", "Wiedent Estetic (skala W)"]);
  });
});

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
