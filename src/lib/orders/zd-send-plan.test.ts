import { describe, expect, it } from "vitest";
import { requestsCoveredByZd } from "./zd-send-plan";

const req = (orderId: string, twId: number | null) => ({ orderId, twId, label: orderId, quantity: "1" });

describe("requestsCoveredByZd", () => {
  it("tylko prośby z produktem na pozycjach ZD", () => {
    const { inZd, notInZd } = requestsCoveredByZd(
      [req("a", 10), req("b", 20), req("c", 30)],
      [{ twId: 10 }, { twId: 30 }, { twId: 99 }]
    );
    expect(inZd.map((r) => r.orderId)).toEqual(["a", "c"]);
    expect(notInZd.map((r) => r.orderId)).toEqual(["b"]);
  });
  it("prośba bez produktu z Subiekta nie jest „w ZD”", () => {
    expect(requestsCoveredByZd([req("x", null)], [{ twId: 1 }]).notInZd).toHaveLength(1);
  });
  it("pozycja dopisana ręcznie w Subiekcie obejmuje swoją prośbę", () => {
    expect(requestsCoveredByZd([req("d", 40)], [{ twId: 10 }, { twId: 40 }]).inZd).toHaveLength(1);
  });
});
