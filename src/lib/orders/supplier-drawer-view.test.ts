import { describe, expect, it } from "vitest";
import { formatSupplierMinOrder, supplierDueInfo } from "@/lib/orders/supplier-drawer-view";

describe("supplierDueInfo", () => {
  const today = "2026-10-01";
  it("rozpoznaje zaległe, dziś, jutro i dalsze terminy", () => {
    expect(supplierDueInfo("2026-09-29", today)).toEqual({ tone: "overdue", relative: "zaległe 2 dni" });
    expect(supplierDueInfo("2026-09-30", today)).toEqual({ tone: "overdue", relative: "zaległe 1 dzień" });
    expect(supplierDueInfo("2026-10-01", today)).toEqual({ tone: "today", relative: "dziś" });
    expect(supplierDueInfo("2026-10-02", today)).toEqual({ tone: "soon", relative: "jutro" });
    expect(supplierDueInfo("2026-10-04", today)).toEqual({ tone: "soon", relative: "za 3 dni" });
    expect(supplierDueInfo("2026-10-12", today)).toEqual({ tone: "later", relative: "za 11 dni" });
  });

  it("bez daty nie wymyśla terminu", () => {
    expect(supplierDueInfo(null, today)).toEqual({ tone: "none", relative: null });
  });
});

describe("formatSupplierMinOrder", () => {
  it("formatuje kwotę z walutą i pomija brak minimum", () => {
    expect(formatSupplierMinOrder(1500, "PLN")).toBe("1500 PLN".replace("1500", new Intl.NumberFormat("pl-PL").format(1500)));
    expect(formatSupplierMinOrder(250, null)).toBe("250");
    expect(formatSupplierMinOrder(0, "PLN")).toBeNull();
    expect(formatSupplierMinOrder(null, "PLN")).toBeNull();
  });
});
