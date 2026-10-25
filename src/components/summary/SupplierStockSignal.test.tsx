/**
 * @vitest-environment happy-dom
 */
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import type { StockWatchSupplierSignal } from "@/lib/stock-watch/signal";
import { SupplierStockSignal, SupplierStockSignalsProvider, stockSignalBeforeDeliveryRest } from "./SupplierStockSignal";

afterEach(cleanup);

const base: StockWatchSupplierSignal = {
  lineCount: 42,
  orderValue: 36354,
  unpricedCount: 1,
  criticalCount: 5,
  beforeDeliveryCount: 8,
  mostUrgent: { twSymbol: "01220500", twNazwa: "Wiertło", daysOfCover: 0 },
  dniZapasu: 28,
  leadDays: 3,
  nextOrderDate: null,
  nextOrderDays: null,
  dataDo: "2026-10-23",
  computedAt: new Date().toISOString(),
};

const renderRow = (s: StockWatchSupplierSignal, hidePrepare = false) =>
  render(
    <SupplierStockSignalsProvider signals={{ sup: s }} canPrepareZd>
      <SupplierStockSignal supplierId="sup" hidePrepare={hidePrepare} />
    </SupplierStockSignalsProvider>
  );

describe("sygnał Braki w wierszu dostawcy", () => {
  it("przed dostawą bez dublowania pilnych", () => {
    expect(stockSignalBeforeDeliveryRest({ criticalCount: 5, beforeDeliveryCount: 8 })).toBe("3 kolejne skończą się przed dostawą");
    expect(stockSignalBeforeDeliveryRest({ criticalCount: 1, beforeDeliveryCount: 1 })).toBeNull();
    expect(stockSignalBeforeDeliveryRest({ criticalCount: 0, beforeDeliveryCount: 2 })).toBe("2 towary skończą się przed dostawą");
    expect(stockSignalBeforeDeliveryRest({ criticalCount: 3, beforeDeliveryCount: 0 })).toBeNull();
  });

  it("linia stanu (pilne, kolejne, najpilniej) i linia zamówienia z przyciskiem Przygotuj ZD", () => {
    const { container } = renderRow(base);
    const [status, order] = [...container.querySelectorAll("p")];
    expect(status?.textContent).toContain("5 pilnych");
    expect(status?.textContent).toContain("3 kolejne skończą się przed dostawą");
    expect(status?.textContent).toContain("najpilniej 01220500 (brak towaru)");
    expect(order?.textContent).toMatch(/Do ZD: 42 poz\. · ok\. 36\s?354\s+zł \(\+1 bez ceny\)/);
    const zd = screen.getByRole("link", { name: "Przygotuj ZD" });
    expect(zd.className).toContain("border-indigo-200");
    expect(zd.className).not.toContain("bg-indigo-600");
  });

  it("z gotowym zamówieniem automatu: tylko linia stanu, bez drugiej drogi do ZD", () => {
    const { container } = renderRow({ ...base, criticalCount: 1, beforeDeliveryCount: 1 }, true);
    expect(container.querySelectorAll("p")).toHaveLength(1);
    expect(container.textContent).toContain("1 pilna");
    expect(container.textContent).not.toContain("przed dostawą");
    expect(screen.queryByRole("link", { name: "Przygotuj ZD" })).toBeNull();
    expect(container.textContent).not.toContain("Do ZD");
  });
});
