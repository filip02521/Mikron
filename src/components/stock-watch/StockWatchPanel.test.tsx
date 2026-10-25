/**
 * @vitest-environment happy-dom
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import type { StockWatchItem, StockWatchSupplierOrder } from "@/lib/stock-watch/data";

const replace = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace, refresh: vi.fn(), push: vi.fn() }),
}));
vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));
vi.mock("@/app/actions/stock-watch", () => ({
  actionSearchStockWatchItems: vi.fn().mockResolvedValue({ ok: true, data: [] }),
  actionStartStockWatchRun: vi.fn(),
  actionSetStockWatchRule: vi.fn(),
}));

import { StockWatchPanel } from "./StockWatchPanel";
import { buildStockWatchDashboard } from "@/lib/stock-watch/dashboard";

function item(over: Partial<StockWatchItem>): StockWatchItem {
  return {
    subiektTwId: 1,
    supplierId: "a",
    runId: "r1",
    twSymbol: "A-1",
    twNazwa: "Towar A",
    grtNazwa: null,
    scopeMode: "grupa",
    scopeId: 10,
    stockQty: 0,
    reservedQty: 0,
    availableQty: 0,
    openZdQty: 0,
    openZkUnreservedQty: 0,
    salesPeriodQty: 30,
    salesPeriodDays: 30,
    velocityDaily: 1,
    velocityTrend: null,
    daysOfCover: 0,
    runOutDate: null,
    bufferDays: 30,
    targetQty: 30,
    minStockQty: null,
    inOrder: true,
    orderZdUnits: 5,
    orderUnitLabel: "szt.",
    orderPieces: 5,
    orderIndividualPieces: 0,
    orderValue: 50,
    unitPriceNet: 10,
    dailyValue: 10,
    deliveryRisk: null,
    status: "out_of_stock",
    computedAt: "2026-10-14T05:30:00Z",
    supplierName: "Dostawca A",
    rule: "standard",
    ruleNote: null,
    priceDokNr: null,
    priceDate: null,
    bomRole: null,
    pairRole: null,
    assemblyKind: null,
    assemblyQty: null,
    assemblyNote: null,
    ...over,
  };
}

function order(over: Partial<StockWatchSupplierOrder>): StockWatchSupplierOrder {
  return {
    supplierId: "a",
    supplierName: "Dostawca A",
    runId: "r1",
    scopeMode: "grupa",
    scopeId: 10,
    dniZapasu: 30,
    dataOd: "2026-09-14",
    dataDo: "2026-10-13",
    lineCount: 0,
    zdUnitsSum: 0,
    orderValue: 0,
    unpricedCount: 0,
    explodeBomIncomplete: false,
    historyFetchFailed: false,
    pendingIndividualsError: null,
    truncated: false,
    leadDays: 7,
    leadSource: "p90",
    leadSamples: 6,
    nextOrderDate: null,
    nextOrderDays: null,
    computedAt: "2026-10-14T05:30:00Z",
    ...over,
  };
}

const dashboardItems = [
    item({}),
    item({
      subiektTwId: 2,
      supplierId: "n",
      supplierName: "Dostawca N",
      twSymbol: "N-1",
      status: "warning",
      availableQty: 8,
      daysOfCover: 8,
      inOrder: false,
      orderZdUnits: 0,
      deliveryRisk: "before_next_delivery",
    }),
];
const dashboardOrders = [order({}), order({ supplierId: "n", supplierName: "Dostawca N" })];
const dashboard = buildStockWatchDashboard(dashboardItems, dashboardOrders);

function renderPanel(props: Partial<Parameters<typeof StockWatchPanel>[0]> = {}) {
  return render(
    <StockWatchPanel
      dashboard={dashboard}
      run={null}
      canMutate
      coverage={{ active: 2, mapped: 2 }}
      {...props}
    />
  );
}

const selectedTab = () => screen.getAllByRole("tab").find((t) => t.getAttribute("aria-selected") === "true");

afterEach(() => {
  cleanup();
  replace.mockClear();
});

describe("StockWatchPanel", () => {
  it("opens on the supplier board by default and on the list for ?filtr=", () => {
    renderPanel();
    expect(selectedTab()?.textContent).toContain("Dostawcy");
    cleanup();
    renderPanel({ initialAlertFilter: "puste" });
    expect(selectedTab()?.textContent).toContain("Wszystkie braki");
  });

  it("'Lista braków dostawcy' switches to the list even when the supplier filter is already set", () => {
    renderPanel({ initialSupplierId: "a", initialSupplierName: "Dostawca A" });
    expect(selectedTab()?.textContent).toContain("Dostawcy");
    // Tablica renderuje widok telefonu i desktopu — oba przyciski robią to samo.
    fireEvent.click(screen.getAllByRole("button", { name: "Lista braków dostawcy" })[0]!);
    expect(selectedTab()?.textContent).toContain("Wszystkie braki");
    expect(replace).toHaveBeenCalledWith("/zakupy/braki?dostawca=a&tab=alerts", { scroll: false });
  });

  it("'Puste · bez dostawy' is a filter chip in the list's filter row", () => {
    renderPanel({ initialTab: "alerts" });
    const chip = screen.getByRole("button", { name: /Puste · bez dostawy/ });
    expect(chip.getAttribute("aria-pressed")).toBe("false");
    fireEvent.click(chip);
    expect(chip.getAttribute("aria-pressed")).toBe("true");
    expect(replace).toHaveBeenLastCalledWith("/zakupy/braki?filtr=puste", { scroll: false });
    expect(screen.getAllByRole("status").some((s) => s.textContent === "1 pozycja")).toBe(true);
  });

  it("expands a 'Wkrótce' supplier into its next-delivery risks", () => {
    renderPanel({ initialSupplierId: "n", initialSupplierName: "Dostawca N" });
    const desktop = screen.getAllByRole("table")[0]!;
    expect(within(desktop).getAllByText("N-1").length).toBeGreaterThan(0);
    expect(screen.queryByText(/towar jedzie/)).toBeNull();
  });

  it("supplier list shows the same urgent rows as the board row, incl. 'Przed kolejną'", () => {
    renderPanel({
      dashboard: buildStockWatchDashboard(dashboardItems, dashboardOrders, { alertsSupplierId: "n" }),
      initialSupplierId: "n",
      initialSupplierName: "Dostawca N",
      initialTab: "alerts",
    });
    expect(screen.getByRole("heading", { name: "Pilne u dostawcy" })).toBeTruthy();
    expect(screen.getByRole("button", { name: /Przed kolejną/ })).toBeTruthy();
    expect(screen.getAllByText("N-1").length).toBeGreaterThan(0);
    cleanup();
    renderPanel({ initialTab: "alerts" });
    expect(screen.getByRole("heading", { name: "Do zamówienia dziś" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Przed kolejną/ })).toBeNull();
  });
});
