// Backtest liczy cel `max30_90` sam (sim.mjs, sim1y.mjs) — ten test pilnuje, że wzór = kod silnika.
import { describe, expect, it } from "vitest";
import { effectiveDniZapasu } from "@/lib/orders/zd-demand-policy";
// @ts-expect-error — moduł .mjs bez typów (skrypt backtestu)
import { leadAt, nearestRank, packRound } from "./sim1y.mjs";
import { computeZdPackOrderQty } from "@/lib/orders/zd-estimate-packaging";

const backtestDays = (target: number, R: number, L90: number) => Math.max(target, R + L90 + Math.round(L90 * 0.25));

describe("backtest ZD PL — zgodność z silnikiem", () => {
  it("dni celu max30_90 = effectiveDniZapasu dla cyklu 7 i różnych czasów dostawy", () => {
    for (const L of [1, 2, 3, 5, 7, 10, 14, 21, 38, 55]) {
      const engine = effectiveDniZapasu({ strategy: "max30_90", targetDays: 25, cycleDays: 7 }, 30, { leadDays: L, nextOrderDays: 0 });
      expect(engine).toBe(backtestDays(25, 7, L));
    }
  });

  it("zaokrąglenie do opakowań = computeZdPackOrderQty (sztuki dochodzące)", () => {
    const cases: Array<[number, [number, string, number]]> = [
      [1, [6, "packages", 0]], [7, [6, "packages", 0]], [13, [6, "pieces_multiple", 0]], [5, [10, "packages", 3]], [31, [10, "packages", 3]],
    ];
    for (const [need, pack] of cases) {
      const ref = computeZdPackOrderQty(need, pack[0], "op.", pack[1] as "packages", pack[2]);
      expect(packRound(need, pack)).toBe(ref.piecesArriving);
    }
  });

  it("p90 nearest-rank i okno 24 mies. sprzed decyzji", () => {
    expect(nearestRank([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 0.9)).toBe(9);
    const samples = [
      { d: "2023-01-10", bd: 30 }, // poza oknem 24 mies.
      ...Array.from({ length: 10 }, (_, i) => ({ d: `2025-0${(i % 9) + 1}-15`, bd: i + 1 })),
      { d: "2025-12-01", bd: 99 }, // po dniu decyzji — niewidoczna
    ];
    // p90 z 1..10 = 9 dni roboczych; 2025-11-03 (pn) + 9 dni rob. = 2025-11-14 → 11 dni kalendarzowych
    expect(leadAt(samples, "2025-11-03")).toBe(11);
  });
});
