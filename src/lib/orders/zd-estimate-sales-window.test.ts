import { describe, expect, it } from "vitest";
import {
  nextDataOdAfterDataDoChange,
  resolveLaunchDniZapasu,
  shouldApplyStockSalesWindow,
} from "./zd-estimate-sales-window";

describe("shouldApplyStockSalesWindow", () => {
  it("stock — tak, manual — nie", () => {
    expect(shouldApplyStockSalesWindow("stock")).toBe(true);
    expect(shouldApplyStockSalesWindow("manual")).toBe(false);
  });
});

describe("nextDataOdAfterDataDoChange", () => {
  it("manual — nie rusza Data od przy zmianie Data do", () => {
    expect(
      nextDataOdAfterDataDoChange({
        source: "manual",
        dataDo: "2026-08-01",
        dataOd: "2026-01-01",
        dniZapasu: 30,
      })
    ).toBe("2026-01-01");
  });

  it("stock — przesuwa Data od wg dniZapasu", () => {
    expect(
      nextDataOdAfterDataDoChange({
        source: "stock",
        dataDo: "2026-08-06",
        dataOd: "2020-01-01",
        dniZapasu: 30,
      })
    ).toBe("2026-07-08");
  });
});

describe("resolveLaunchDniZapasu", () => {
  it("preferuje dostawcę, potem grupę, potem quick group", () => {
    expect(
      resolveLaunchDniZapasu({
        supplierDniZapasu: 60,
        groupDniZapasu: 90,
        quickGroupDniZapasu: 45,
        defaultDni: 30,
      })
    ).toBe(60);
    expect(
      resolveLaunchDniZapasu({
        supplierDniZapasu: null,
        groupDniZapasu: 90,
        quickGroupDniZapasu: 45,
        defaultDni: 30,
      })
    ).toBe(90);
    expect(
      resolveLaunchDniZapasu({
        supplierDniZapasu: null,
        groupDniZapasu: null,
        quickGroupDniZapasu: null,
        defaultDni: 30,
      })
    ).toBe(30);
  });
});
