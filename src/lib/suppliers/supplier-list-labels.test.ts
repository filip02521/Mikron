import { describe, expect, it } from "vitest";
import { formatSupplierCycleSummary, formatSupplierListMeta } from "./supplier-list-labels";

const base = {
  location: "POLSKA" as const,
  notes: "MAILOWO",
  stock_raw: "2 MIESIĄCE",
  stock: 2,
  interval_raw: "6",
  interval_weeks: 6,
  order_on_demand: false,
  extra_info: "",
};

describe("supplier list labels", () => {
  it("formatSupplierListMeta łączy lokalizację i sposób", () => {
    expect(formatSupplierListMeta(base)).toBe("Polska · Mail");
  });

  it("formatSupplierCycleSummary skraca cykl bez powtórzenia słowa zapas", () => {
    const summary = formatSupplierCycleSummary(base);
    expect(summary).toMatch(/6 tyg\./);
    expect(summary).toMatch(/zapas 2 mies\./i);
    expect(summary).not.toMatch(/zapas.*zapas/i);
  });

  it("formatSupplierCycleSummary dla on-demand — badge przy nazwie, w kolumnie cykl pusto", () => {
    expect(
      formatSupplierCycleSummary({
        ...base,
        order_on_demand: true,
        stock_raw: "W RAZIE POTRZEBY",
      })
    ).toBe("—");
  });

  it("formatSupplierCycleSummary gdy brak danych", () => {
    expect(
      formatSupplierCycleSummary({
        ...base,
        stock_raw: "",
        stock: null,
        interval_raw: "",
        interval_weeks: null,
      })
    ).toBe("Uzupełnij cykl");
  });
});
