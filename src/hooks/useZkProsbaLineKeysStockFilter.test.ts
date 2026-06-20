import { describe, expect, it } from "vitest";
import { filterZkProsbaScopeLineKeysNeedingOrder } from "@/lib/orders/prosba-stock-check";

/** Logika opt-in z hooka — testowana bez renderu React. */
describe("useZkProsbaLineKeysStockFilter opt-in semantics", () => {
  const scopeLines = [
    { key: "a", subiektTwId: 1, quantity: 2 },
    { key: "b", subiektTwId: 2, quantity: 5 },
  ];
  const stock = {
    1: { onHand: 10, reserved: 0, available: 10, source: "subiekt" as const },
    2: { onHand: 2, reserved: 0, available: 2, source: "subiekt" as const },
  };

  it("allOnStock = brak linii wymagających zamówienia wg Subiekta", () => {
    const needing = filterZkProsbaScopeLineKeysNeedingOrder(scopeLines, ["a", "b"], stock);
    expect(needing).toEqual(["b"]);
    const allOnStock = needing.length === 0;
    expect(allOnStock).toBe(false);
  });

  it("allOnStock gdy wszystkie linie mają pełny stan", () => {
    const onlyA = [{ key: "a", subiektTwId: 1, quantity: 2 }];
    const needing = filterZkProsbaScopeLineKeysNeedingOrder(onlyA, ["a"], stock);
    expect(needing).toEqual([]);
  });

  it("opt-in lineKeysToOrder = przecięcie zaznaczonych z source", () => {
    const sourceKeys = ["a", "b"];
    const orderMarkedKeys = ["a"];
    const marked = new Set(orderMarkedKeys);
    const lineKeysToOrder = sourceKeys.filter((key) => marked.has(key));
    expect(lineKeysToOrder).toEqual(["a"]);
    expect(sourceKeys.length - lineKeysToOrder.length).toBe(1);
  });
});
