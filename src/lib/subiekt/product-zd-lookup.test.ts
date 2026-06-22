import { describe, expect, it } from "vitest";
import {
  buildAppOrderDeliveryEstimate,
  collectActiveProductZdMatches,
  mergeProductLookupSupplier,
  productLookupSearchOrder,
  productToZdLookupOrder,
  rankProductZdLookupMatches,
  resolveProductZdLookupAppOrderHint,
} from "@/lib/subiekt/product-zd-lookup";
import type { SubiektDocument } from "@/lib/subiekt/types";

function doc(partial: Partial<SubiektDocument> & Pick<SubiektDocument, "dok_Id">): SubiektDocument {
  return {
    dok_NrPelny: "ZD/1/2026",
    dok_DataWyst: "2026-06-01",
    dok_TerminRealizacji: "2026-06-25",
    lines: [],
    dok_Pozycja: [],
    ...partial,
  } as SubiektDocument;
}

describe("product-zd-lookup", () => {
  it("buduje order do dopasowania ZD z produktu Subiekta", () => {
    expect(
      productToZdLookupOrder({
        tw_Id: 42,
        tw_Symbol: "ABC-1",
        tw_Nazwa: "Produkt testowy",
        tw_PLU: "123456",
      })
    ).toMatchObject({
      subiekt_tw_id: 42,
      symbol: "ABC-1",
      products: "Produkt testowy",
      mikran_code: "123456",
    });
  });

  it("zbiera aktywne dopasowania ZD posortowane po terminie", () => {
    const product = {
      tw_Id: 10,
      tw_Symbol: "H364",
      tw_Nazwa: "Freza H364",
    };
    const matches = collectActiveProductZdMatches(
      product,
      [
        doc({
          dok_Id: 2,
          dok_NrPelny: "ZD/B",
          dok_TerminRealizacji: "2099-07-01",
          dok_Pozycja: [{ ob_TowId: 10, ob_Ilosc: 5 }],
        }),
        doc({
          dok_Id: 1,
          dok_NrPelny: "ZD/A",
          dok_TerminRealizacji: "2099-06-20",
          dok_Pozycja: [{ ob_TowId: 10, ob_Ilosc: 2 }],
        }),
      ],
      { supplierId: "s1", supplierName: "Renfert" },
      [{ id: "s1", name: "Renfert", subiektKhId: 100 }]
    );

    expect(matches.map((match) => match.dokNr)).toEqual(["ZD/A", "ZD/B"]);
    expect(matches[0]?.quantity).toBe(2);
    expect(rankProductZdLookupMatches(matches).map((match) => match.deadline)).toEqual([
      "2099-06-20",
      "2099-07-01",
    ]);
  });

  it("używa wyłącznie dostawcy z katalogu produktu", () => {
    expect(
      mergeProductLookupSupplier({ supplierId: "chifa", supplierName: "Chifa" })
    ).toEqual({ supplierId: "chifa", supplierName: "Chifa" });

    expect(
      mergeProductLookupSupplier({ supplierId: null, supplierName: null })
    ).toEqual({ supplierId: null, supplierName: null });
  });

  it("buduje prośbę syntetyczną z datą zamówienia do wyszukiwania ZD", () => {
    const order = productLookupSearchOrder(
      {
        tw_Id: 42,
        tw_Symbol: "KP-213-130-PMK",
        tw_Nazwa: "Kleszcze",
      },
      "2026-05-12T10:00:00.000Z"
    );

    expect(order.symbol).toBe("KP-213-130-PMK");
    expect(order.subiekt_tw_id).toBe(42);
    expect(order.ordered_at).toBe("2026-05-12T10:00:00.000Z");
    expect(order.status).toBe("Zamowione");
  });

  it("szacuje termin z otwartego zamówienia gdy brak ZD", () => {
    const estimate = buildAppOrderDeliveryEstimate({
      placementAt: "2026-05-12",
      orderType: "Glowne",
      statsMode: "LACZNIE",
      supplierId: "chifa",
      deliveryStats: [
        {
          supplier_id: "chifa",
          main_count: 10,
          side_count: 2,
          main_sum: 300,
          side_sum: 40,
          main_avg: 30,
          side_avg: 20,
        },
      ],
    });
    expect(estimate?.estimatedDeadline).toMatch(/2026-/);
    expect(estimate?.estimateLabel).toContain("dni rob.");
  });

  it("resolveProductZdLookupAppOrderHint — tylko przy otwartej prośbie", () => {
    const hint = resolveProductZdLookupAppOrderHint(
      {
        placementAt: "2026-05-12",
        supplierId: "chifa",
        supplierName: "Chifa",
        openOrder: {
          id: "ord-1",
          supplierId: "chifa",
          orderType: "Glowne",
          orderedAt: "2026-05-12",
          statsMode: "LACZNIE",
        },
      },
      [
        {
          supplier_id: "chifa",
          main_count: 10,
          side_count: 2,
          main_sum: 300,
          side_sum: 40,
          main_avg: 30,
          side_avg: 20,
        },
      ]
    );
    expect(hint?.orderId).toBe("ord-1");
    expect(hint?.estimateLabel).toContain("dni rob.");
    expect(
      resolveProductZdLookupAppOrderHint(
        { placementAt: null, supplierId: null, supplierName: null, openOrder: null },
        []
      )
    ).toBeNull();
  });
});
