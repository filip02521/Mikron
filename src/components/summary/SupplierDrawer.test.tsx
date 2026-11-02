/**
 * @vitest-environment happy-dom
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { SupplierSummaryMeta } from "@/lib/orders/summary-workspace";

vi.mock("@/app/actions/admin", () => ({
  actionFetchSupplierRecentHistory: vi.fn().mockResolvedValue([]),
  actionMarkOrdered: vi.fn(),
  actionShiftOrder: vi.fn(),
}));
vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

import { SupplierDrawer } from "./SupplierDrawer";
import { SupplierStockSignalsProvider } from "./SupplierStockSignal";
import type { StockWatchSupplierSignal } from "@/lib/stock-watch/signal";

const supplier: SupplierSummaryMeta = {
  id: "e6b2b188-2d67-4953-8002-159162cc08ee",
  name: "Ivoclar Vivadent - EXCEL",
  location: "ZAGRANICA",
  mails: "MBLIOrdersPL@ivoclar.com",
  notes: "",
  extra_info: "",
  interval_raw: "1",
  interval_weeks: 1,
  stock_raw: "2 mies.",
  stock: 60,
  pickup_mikran: false,
  pickup_pallet: false,
  order_on_demand: false,
  is_active: true,
  order_date: "2026-09-03",
  shift_date: null,
  computed_next_date: "2026-09-10",
  vacation_note: null,
  stats_mode: "LACZNIE",
  subiekt_kh_id: 42,
  min_order_value: 500,
  min_order_currency: "EUR",
};

describe("SupplierDrawer - tryb podglądu (okno po utworzeniu ZD)", () => {
  afterEach(() => cleanup());

  it("pokazuje dane dostawcy bez akcji zmieniających termin, z przejściem do panelu dziennego", () => {
    render(<SupplierDrawer mode="preview" supplier={supplier} onClose={() => {}} />);
    expect(screen.getByRole("dialog", { name: "Ivoclar Vivadent - EXCEL" })).toBeTruthy();
    expect(screen.getByText(/500/)).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Zamówione/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /Urlop/ })).toBeNull();
    const dailyLink = screen.getByRole("link", { name: /Otwórz w panelu dziennym/ });
    expect(dailyLink.getAttribute("href")).toBe(
      "/podsumowanie?view=dzis&supplierId=e6b2b188-2d67-4953-8002-159162cc08ee"
    );
    expect(screen.getByRole("link", { name: /Karta dostawcy/ })).toBeTruthy();
  });

  it("Escape zamyka tylko podgląd - nie dochodzi do okna pod spodem", async () => {
    const onClose = vi.fn();
    const modalEscape = vi.fn();
    window.addEventListener("keydown", modalEscape);
    render(<SupplierDrawer mode="preview" supplier={supplier} onClose={onClose} />);
    act(() => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    });
    // Zamknięcie czeka na animację wyjazdu panelu.
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
    expect(modalEscape).not.toHaveBeenCalled();
    window.removeEventListener("keydown", modalEscape);
  });

  it("skrót Z (Zamówione) nie działa w podglądzie", () => {
    render(<SupplierDrawer mode="preview" supplier={supplier} onClose={() => {}} />);
    fireEvent.keyDown(window, { key: "z" });
    expect(screen.queryByRole("alertdialog")).toBeNull();
    expect(screen.queryByText(/Oznaczyć/)).toBeNull();
  });
});

describe("SupplierDrawer - stan magazynu z analizy Braki", () => {
  afterEach(() => cleanup());

  const signal: StockWatchSupplierSignal = {
    lineCount: 14,
    orderValue: 3200,
    unpricedCount: 2,
    criticalCount: 2,
    beforeDeliveryCount: 3,
    mostUrgent: { twSymbol: "IV-123", twNazwa: "Tetric EvoCeram A2", daysOfCover: 0.5 },
    dniZapasu: 28,
    leadDays: 9,
    nextOrderDate: "2026-09-10",
    nextOrderDays: 7,
    dataDo: "2026-09-02",
    computedAt: new Date().toISOString(),
  };

  function renderPanel(s: StockWatchSupplierSignal | null) {
    return render(
      <SupplierStockSignalsProvider signals={s ? { [supplier.id]: s } : {}} canPrepareZd>
        <SupplierDrawer
          supplier={supplier}
          onClose={() => {}}
          isScopePending={() => false}
          run={vi.fn()}
          canPrepareZd
        />
      </SupplierStockSignalsProvider>
    );
  }

  it("pokazuje pilne, Do ZD z wartością, przed dostawą, termin i link do Braki; Przygotuj ZD jest główną akcją", () => {
    // „za N dni” liczone od dziś, nie z dnia analizy (nextOrderDays bywa nieaktualne).
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-09-03T10:00:00+02:00"));
    try {
      renderPanel({ ...signal, nextOrderDays: 99, computedAt: new Date().toISOString() });
    } finally {
      vi.useRealTimers();
    }
    const section = screen.getByRole("region", { name: "Stan magazynu (analiza Braki)" });
    const text = section.textContent ?? "";
    expect(text).toContain("2 pilne");
    expect(text).toMatch(/Do ZD: 14 poz\. · ok\. 3\s?200\s+zł \(\+2 bez ceny\)/);
    // Pilne są w szerokim liczniku „przed dostawą” — pokazujemy tylko kolejne.
    expect(text).toContain("1 kolejny skończy się przed dostawą");
    expect(text).not.toContain("3 towary skończą się");
    expect(text).toContain("Najpilniej IV-123 (< 1 dzień)");
    expect(text).toContain("Dostawa ok. 9 dni · kolejne zamówienie 10.09 (za 7 dni)");
    expect(text).not.toContain("nieaktualna");
    expect(screen.getByRole("link", { name: "Pokaż w Braki" }).getAttribute("href")).toBe(
      `/zakupy/braki?dostawca=${supplier.id}`
    );
    const zd = screen.getByRole("link", { name: /Przygotuj ZD/ });
    expect(zd.querySelector("button")).toBeNull();
    expect(zd.className).toContain("bg-indigo-600");
    expect(screen.getByRole("button", { name: /Zamówione/ }).className).not.toContain("bg-indigo-600");
  });

  it("nieaktualna analiza bez pozycji nie twierdzi, że stan wystarcza", () => {
    renderPanel({
      ...signal,
      lineCount: 0,
      orderValue: 0,
      unpricedCount: 0,
      criticalCount: 0,
      beforeDeliveryCount: 0,
      mostUrgent: null,
      computedAt: "2026-01-01T00:00:00Z",
    });
    const text = screen.getByRole("region", { name: "Stan magazynu (analiza Braki)" }).textContent ?? "";
    expect(text).not.toContain("Stan wystarcza");
    expect(text).toContain("analiza z 01.01 - może być nieaktualna");
    expect(screen.getByRole("link", { name: /Przygotuj ZD/ }).className).not.toContain("bg-indigo-600");
  });

  it("bez analizy dostawcy sekcji nie ma", () => {
    renderPanel(null);
    expect(screen.queryByRole("region", { name: "Stan magazynu (analiza Braki)" })).toBeNull();
  });
});

describe("SupplierDrawer - warstwy nad panelem dziennym", () => {
  afterEach(() => cleanup());

  function renderPanel() {
    return render(
      <SupplierDrawer supplier={supplier} onClose={() => {}} isScopePending={() => false} run={vi.fn()} />
    );
  }

  it("panel jest w portalu w <body>, nie w kontenerze strony", () => {
    const { container } = renderPanel();
    const aside = document.querySelector("aside[aria-labelledby='supplier-drawer-title']");
    expect(aside?.parentElement).toBe(document.body);
    expect(container.contains(aside)).toBe(false);
    expect(aside?.className).toContain("z-[60]");
  });

  it("Escape przy otwartym menu Przesuń zamyka tylko menu; drugi Escape dochodzi do panelu", () => {
    renderPanel();
    // Odbiorca jak w SummaryWorkspace: zamyka szufladę, gdy Escape nie obsłużyła warstwa nad nią.
    const panelClose = vi.fn();
    const onWindowKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (e.defaultPrevented || document.querySelector('[role="alertdialog"], [role="menu"]')) return;
      panelClose();
    };
    window.addEventListener("keydown", onWindowKey);
    try {
      const trigger = screen.getByRole("button", { name: /Przesuń/ });
      fireEvent.click(trigger);
      expect(screen.getByRole("menu")).toBeTruthy();

      fireEvent.keyDown(trigger, { key: "Escape" });
      expect(screen.queryByRole("menu")).toBeNull();
      expect(panelClose).not.toHaveBeenCalled();
      expect(document.activeElement).toBe(trigger);

      fireEvent.keyDown(trigger, { key: "Escape" });
      expect(panelClose).toHaveBeenCalledTimes(1);
    } finally {
      window.removeEventListener("keydown", onWindowKey);
    }
  });
});
