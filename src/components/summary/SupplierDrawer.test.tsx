/**
 * @vitest-environment happy-dom
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
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

  it("Escape zamyka tylko podgląd - nie dochodzi do okna pod spodem", () => {
    const onClose = vi.fn();
    const modalEscape = vi.fn();
    window.addEventListener("keydown", modalEscape);
    render(<SupplierDrawer mode="preview" supplier={supplier} onClose={onClose} />);
    act(() => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    });
    expect(onClose).toHaveBeenCalledTimes(1);
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
