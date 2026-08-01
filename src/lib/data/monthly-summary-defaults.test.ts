import { describe, expect, it } from "vitest";
import {
  allocatePercentageShares,
  buildMonthlyMomComparison,
  momChange,
  nextMonthKeyFromMonthKey,
  previousMonthKeyFromMonthKey,
  shareOfTotal,
  sortSalesRanking,
  type MonthDepartmentTotals,
} from "./monthly-stats-shared";
import {
  defaultMonthlySummaryTabForRole,
  isMonthlySummaryTab,
} from "./monthly-summary-defaults";

describe("previousMonthKeyFromMonthKey", () => {
  it("cofa o miesiąc i przez rok", () => {
    expect(previousMonthKeyFromMonthKey("2026-08")).toBe("2026-07");
    expect(previousMonthKeyFromMonthKey("2026-01")).toBe("2025-12");
  });
});

describe("nextMonthKeyFromMonthKey", () => {
  it("przesuwa do przodu", () => {
    expect(nextMonthKeyFromMonthKey("2026-07")).toBe("2026-08");
    expect(nextMonthKeyFromMonthKey("2025-12")).toBe("2026-01");
  });
});

describe("momChange", () => {
  it("liczy deltę i procent", () => {
    expect(momChange(120, 100)).toEqual({
      current: 120,
      previous: 100,
      delta: 20,
      pct: 20,
    });
    expect(momChange(80, 100).pct).toBe(-20);
    expect(momChange(5, 0).pct).toBeNull();
    expect(momChange(0, 0).pct).toBe(0);
  });
});

describe("shareOfTotal / allocatePercentageShares", () => {
  it("liczy udział w sumie a nie względem lidera", () => {
    expect(shareOfTotal(50, 200)).toBe(25);
    expect(shareOfTotal(50, 50)).toBe(100);
    expect(shareOfTotal(10, 0)).toBe(0);
  });

  it("sumuje udziały dokładnie do 100", () => {
    const shares = allocatePercentageShares([1, 1, 1]);
    expect(shares.reduce((a, b) => a + b, 0)).toBe(100);
    expect(allocatePercentageShares([33, 33, 34]).reduce((a, b) => a + b, 0)).toBe(100);
    expect(allocatePercentageShares([0, 0])).toEqual([0, 0]);
  });
});

const emptyTotals = (): MonthDepartmentTotals => ({
  salesRequestsCreated: 0,
  salesRequestsCompleted: 0,
  salesSuccessRate: 0,
  zkClosed: 0,
  zkOpen: 0,
  deliveryReceipts: 0,
  deliveryPackages: 0,
  deliveryPallets: 0,
  procurementOrders: 0,
  procurementCompleted: 0,
  procurementSuccessRate: 0,
  procurementAvgDeliveryDays: null,
  teethRequestsCreated: 0,
  teethOrdered: 0,
  teethCompleted: 0,
  teethSuccessRate: 0,
});

describe("buildMonthlyMomComparison", () => {
  it("składa porównanie z agregatów", () => {
    const current: MonthDepartmentTotals = {
      ...emptyTotals(),
      salesRequestsCreated: 10,
      salesRequestsCompleted: 8,
      salesSuccessRate: 80,
      zkClosed: 3,
      zkOpen: 0,
      deliveryReceipts: 20,
      deliveryPackages: 40,
      deliveryPallets: 2,
      procurementOrders: 15,
      procurementCompleted: 12,
      procurementSuccessRate: 80,
      procurementAvgDeliveryDays: 5,
      teethRequestsCreated: 4,
      teethOrdered: 3,
      teethCompleted: 2,
      teethSuccessRate: 50,
    };
    const previous: MonthDepartmentTotals = {
      ...emptyTotals(),
      salesRequestsCreated: 8,
      salesRequestsCompleted: 6,
      salesSuccessRate: 75,
      zkClosed: 2,
      zkOpen: 1,
      deliveryReceipts: 10,
      deliveryPackages: 20,
      deliveryPallets: 1,
      procurementOrders: 10,
      procurementCompleted: 8,
      procurementSuccessRate: 80,
      procurementAvgDeliveryDays: 6,
      teethRequestsCreated: 2,
      teethOrdered: 1,
      teethCompleted: 1,
      teethSuccessRate: 50,
    };
    const mom = buildMonthlyMomComparison("2026-07", current, previous);
    expect(mom.previousMonthKey).toBe("2026-06");
    expect(mom.sales.requestsCreated.delta).toBe(2);
    expect(mom.delivery.totalReceipts.pct).toBe(100);
    expect(mom.procurement.avgDeliveryDays?.delta).toBe(-1);
    expect(mom.teeth.requestsCreated.delta).toBe(2);
    expect(mom.sales.zkOpen.delta).toBe(-1);
  });
});

describe("sortSalesRanking", () => {
  const people = [
    {
      salesPersonId: "a",
      salesPersonName: "A",
      requestsCreated: 10,
      requestsCompleted: 5,
      requestsCancelled: 0,
      zkClosed: 1,
      zkOpen: 0,
    },
    {
      salesPersonId: "b",
      salesPersonName: "B",
      requestsCreated: 4,
      requestsCompleted: 4,
      requestsCancelled: 0,
      zkClosed: 8,
      zkOpen: 0,
    },
  ];

  it("sortuje po skuteczności i ZK", () => {
    expect(sortSalesRanking(people, "successRate")[0]?.salesPersonId).toBe("b");
    expect(sortSalesRanking(people, "zkClosed")[0]?.salesPersonId).toBe("b");
    expect(sortSalesRanking(people, "requests")[0]?.salesPersonId).toBe("a");
  });

  it("pomija osoby tylko z otwartymi ZK", () => {
    const withOpenOnly = [
      ...people,
      {
        salesPersonId: "c",
        salesPersonName: "C",
        requestsCreated: 0,
        requestsCompleted: 0,
        requestsCancelled: 0,
        zkClosed: 0,
        zkOpen: 5,
      },
    ];
    expect(sortSalesRanking(withOpenOnly, "requests").map((p) => p.salesPersonId)).toEqual([
      "a",
      "b",
    ]);
  });
});

describe("defaultMonthlySummaryTabForRole", () => {
  it("mapuje rolę / workspace na dział", () => {
    expect(defaultMonthlySummaryTabForRole("sales")).toBe("handlowcy");
    expect(defaultMonthlySummaryTabForRole("sales_manager")).toBe("handlowcy");
    expect(defaultMonthlySummaryTabForRole("magazyn")).toBe("dostawy");
    expect(defaultMonthlySummaryTabForRole("zakupy")).toBe("zakupy");
    expect(defaultMonthlySummaryTabForRole("zakupy_zeby")).toBe("zeby");
    expect(defaultMonthlySummaryTabForRole("admin")).toBe("zakupy");
    expect(defaultMonthlySummaryTabForRole("admin", ["dostawy"])).toBe("zakupy");
    expect(defaultMonthlySummaryTabForRole("admin", ["zeby"])).toBe("zeby");
    expect(defaultMonthlySummaryTabForRole("admin", ["magazyn"])).toBe("dostawy");
  });

  it("rozpoznaje tab z URL", () => {
    expect(isMonthlySummaryTab("zeby")).toBe(true);
    expect(isMonthlySummaryTab("foo")).toBe(false);
  });
});
