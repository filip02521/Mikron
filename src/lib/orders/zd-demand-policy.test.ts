import { describe, expect, it } from "vitest";
import {
  applyZdDemandFloorToLine,
  effectiveDniZapasu,
  sales90FromProfile,
  ZD_SUPPLIER_ORDER_POLICY_CLASSIC,
  type ZdSupplierOrderPolicy,
} from "./zd-demand-policy";

const test: ZdSupplierOrderPolicy = { strategy: "max30_90", targetDays: 21, cycleDays: 3 };

describe("zd-demand-policy", () => {
  it("dni zapasu: strategia nadpisuje dostawcę, classic zostawia", () => {
    expect(effectiveDniZapasu(test, 30)).toBe(21);
    expect(effectiveDniZapasu(ZD_SUPPLIER_ORDER_POLICY_CLASSIC, 30)).toBe(30);
  });

  it("90 d z ostatnich trzech okien profilu", () => {
    expect(sales90FromProfile([9, 9, 9, 9, 9, 9, 9, 9, 9, 10, 20, 30])).toBe(60);
    expect(sales90FromProfile(null)).toBeNull();
  });

  it("słabszy miesiąc: tempo i cel podniesione do średniej 90 d", () => {
    // okno 30 d: 6 szt (0,2/d), 90 d: 36 szt (0,4/d); cel z API 6/30×21 + 2 = 6,2
    const out = applyZdDemandFloorToLine(
      { sprzedazOkres: 6, sprzedazDziennie: 0.2, celZapasu: 6.2 },
      { policy: test, sales90: 36, dniOkresu: 30, dniZapasu: 21 }
    );
    expect(out.sprzedazOkres).toBeCloseTo(12);
    expect(out.celZapasu).toBeCloseTo(6.2 + 0.2 * 21);
  });

  it("brak sprzedaży w oknie, ale była w 90 d — cel z tempa 90 d", () => {
    const out = applyZdDemandFloorToLine(
      { sprzedazOkres: 0, sprzedazDziennie: 0, celZapasu: 0 },
      { policy: test, sales90: 9, dniOkresu: 30, dniZapasu: 21 }
    );
    expect(out.celZapasu).toBeCloseTo(0.1 * 21);
  });

  it("nigdy nie obniża; classic i brak profilu bez zmian", () => {
    const line = { sprzedazOkres: 30, sprzedazDziennie: 1, celZapasu: 21 };
    expect(applyZdDemandFloorToLine(line, { policy: test, sales90: 30, dniOkresu: 30, dniZapasu: 21 })).toBe(line);
    expect(applyZdDemandFloorToLine(line, { policy: ZD_SUPPLIER_ORDER_POLICY_CLASSIC, sales90: 900, dniOkresu: 30, dniZapasu: 21 })).toBe(line);
    expect(applyZdDemandFloorToLine(line, { policy: test, sales90: null, dniOkresu: 30, dniZapasu: 21 })).toBe(line);
  });
});
