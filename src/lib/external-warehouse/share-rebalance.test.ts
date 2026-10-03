import { describe, expect, it } from "vitest";
import { describeShareRebalance, planShareRebalance } from "./share-rebalance";

const share = (pallet_label: string, qty: number, note: string | null = null) => ({ pallet_label, qty, note });

describe("planShareRebalance", () => {
  it("ZK 7942: ECOtray 1008 → 504 przy paletach 504 + 504 — zdejmuje ostatnią paletę", () => {
    const plan = planShareRebalance([share("Mikran 11", 504, "góra"), share("Mikran 10", 504)], 504)!;
    expect(plan.keep).toEqual([share("Mikran 10", 504)]);
    expect(plan.removed).toEqual([share("Mikran 11", 504, "góra")]);
    expect(plan.reduced).toEqual([]);
    expect(plan.trimmed).toBe(504);
    expect(describeShareRebalance(plan)).toBe("zdjęto paletę „Mikran 11” (504 szt.)");
  });

  it("numeryczna kolejność palet: „Fast 10” jest po „Fast 2”", () => {
    const plan = planShareRebalance([share("Fast 2", 100), share("Fast 10", 100), share("Fast 1", 100)], 200)!;
    expect(plan.removed.map((s) => s.pallet_label)).toEqual(["Fast 10"]);
  });

  it("częściowe zmniejszenie — ostatnia paleta dostaje mniej", () => {
    const plan = planShareRebalance([share("A 1", 40), share("A 2", 40), share("A 3", 40)], 100)!;
    expect(plan.keep).toEqual([share("A 1", 40), share("A 2", 40), share("A 3", 20)]);
    expect(plan.reduced).toEqual([{ pallet_label: "A 3", from: 40, to: 20 }]);
    expect(describeShareRebalance(plan)).toBe("„A 3” 40 → 20 szt.");
  });

  it("nadmiar większy niż jedna paleta — zdejmuje kilka i przycina kolejną", () => {
    const plan = planShareRebalance([share("P 1", 30), share("P 2", 30), share("P 3", 30)], 25)!;
    expect(plan.keep).toEqual([share("P 1", 25)]);
    expect(plan.removed.map((s) => s.pallet_label)).toEqual(["P 2", "P 3"]);
  });

  it("bez korekty: suma mieści się w ZK, brak ilości albo brak palet", () => {
    expect(planShareRebalance([share("A", 40)], 120)).toBeNull();
    expect(planShareRebalance([share("A", 40)], 40)).toBeNull();
    expect(planShareRebalance([share("A", 40)], null)).toBeNull();
    expect(planShareRebalance([], 10)).toBeNull();
  });

  it("ilości ułamkowe bez błędów zaokrągleń", () => {
    const plan = planShareRebalance([share("A", 0.3), share("B", 0.3)], 0.4)!;
    expect(plan.keep).toEqual([share("A", 0.3), share("B", 0.1)]);
  });
});
