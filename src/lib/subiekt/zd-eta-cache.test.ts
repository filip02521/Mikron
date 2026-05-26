import { describe, expect, it } from "vitest";
import {
  buildZdEtaOrdersFingerprint,
  countZdEligibleOrders,
  countZdSkippedNoSubiektLink,
  ZD_ETA_CACHE_REVALIDATE_SEC,
} from "./zd-eta-cache";
import type { OrderZdLookupInput } from "./zd-eta";

function order(
  extra: Partial<OrderZdLookupInput> & { id: string }
): OrderZdLookupInput {
  return {
    symbol: "ABC",
    products: "Produkt",
    status: "Zamowione",
    request_kind: "zamowienie",
    supplier: { name: "Dostawca", subiekt_kh_id: 100 },
    ...extra,
  };
}

describe("zd-eta-cache", () => {
  it("liczy prośby kwalifikujące się do ZD", () => {
    const orders = [
      order({ id: "1" }),
      order({ id: "2", status: "Anulowane", request_kind: "zamowienie" }),
      order({ id: "3", request_kind: "informacja" }),
      order({ id: "4", status: "Czesciowo_zrealizowane" }),
    ];
    expect(countZdEligibleOrders(orders)).toBe(2);
  });

  it("nie liczy prośb bez powiązania dostawcy z Subiektem", () => {
    const orders = [
      order({ id: "1", supplier: { name: "Bez linku" } }),
      order({ id: "2", supplier: { name: "Z linkiem", subiekt_kh_id: 5 } }),
    ];
    expect(countZdEligibleOrders(orders)).toBe(1);
  });

  it("fingerprint zmienia się przy nowej prośbie", () => {
    const a = buildZdEtaOrdersFingerprint([order({ id: "1" })]);
    const b = buildZdEtaOrdersFingerprint([order({ id: "1" }), order({ id: "2" })]);
    expect(a).not.toBe(b);
  });

  it("fingerprint uwzględnia powiązanie dostawcy z Subiektem", () => {
    const a = buildZdEtaOrdersFingerprint([
      order({ id: "1", supplier: { name: "A", subiekt_kh_id: 10 } }),
    ]);
    const b = buildZdEtaOrdersFingerprint([
      order({ id: "1", supplier: { name: "A", subiekt_kh_id: 99 } }),
    ]);
    expect(a).not.toBe(b);
  });

  it("liczy prośby pominięte bez powiązania Subiekt", () => {
    const orders = [
      order({ id: "1", supplier: { name: "Bez linku" } }),
      order({ id: "2", status: "Anulowane", supplier: { name: "X" } }),
      order({ id: "3", supplier: { name: "Z linkiem", subiekt_kh_id: 5 } }),
    ];
    expect(countZdSkippedNoSubiektLink(orders)).toBe(1);
  });

  it("cache TTL to 2 godziny", () => {
    expect(ZD_ETA_CACHE_REVALIDATE_SEC).toBe(7200);
  });
});
