import { describe, expect, it } from "vitest";
import { toggleAllExpandedIds } from "./my-order-shipment-card-helpers";

describe("toggleAllExpandedIds", () => {
  const ids = ["a", "b", "c"];

  it("dwa szybkie kliknięcia: rozwija, potem zwija (z poprzedniego stanu, nie z renderu)", () => {
    // Dwie aktualizacje w jednym renderze — jak dwa kliknięcia przed ponownym renderem.
    const afterFirst = toggleAllExpandedIds(new Set(), ids);
    const afterSecond = toggleAllExpandedIds(afterFirst, ids);
    expect([...afterFirst].sort()).toEqual(ids);
    expect(afterSecond.size).toBe(0);
  });

  it("część rozwinięta → rozwija wszystkie", () => {
    expect([...toggleAllExpandedIds(new Set(["b"]), ids)].sort()).toEqual(ids);
  });
});
