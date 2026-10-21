/**
 * @vitest-environment happy-dom
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { StockWatchOffPlanSupplier } from "@/lib/stock-watch/data";

vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

import { StockWatchOffPlanBanner } from "./StockWatchOffPlanBanner";

afterEach(cleanup);

function supplier(i: number, over: Partial<StockWatchOffPlanSupplier> = {}): StockWatchOffPlanSupplier {
  return { supplierId: `s${i}`, supplierName: `Dostawca ${i}`, count: 2, nextOrderDate: null, onDemand: true, ...over };
}

describe("StockWatchOffPlanBanner", () => {
  it("nic nie renderuje bez dostawców", () => {
    const { container } = render(<StockWatchOffPlanBanner suppliers={[]} canPrepareZd />);
    expect(container.innerHTML).toBe("");
  });

  it("tytuł odmienia liczbę dostawców (u 1 dostawcy / u 2 dostawców)", () => {
    render(<StockWatchOffPlanBanner suppliers={[supplier(1)]} canPrepareZd />);
    expect(screen.getByText(/Zamów dziś poza planem u/).textContent).toMatch(/u 1 dostawcy$/);
    cleanup();
    render(<StockWatchOffPlanBanner suppliers={[supplier(1), supplier(2)]} canPrepareZd />);
    expect(screen.getByText(/Zamów dziś poza planem u/).textContent).toMatch(/u 2 dostawców$/);
  });

  it("wiersz: liczba towarów, plan albo „na żądanie”, link do Kreatora", () => {
    render(
      <StockWatchOffPlanBanner
        suppliers={[supplier(1, { count: 23 }), supplier(2, { count: 1, onDemand: false })]}
        canPrepareZd
      />
    );
    expect(screen.getByText("23 towary")).toBeTruthy();
    expect(screen.getByText("1 towar")).toBeTruthy();
    expect(screen.getByText("na żądanie")).toBeTruthy();
    expect(screen.getByText("brak terminu planu")).toBeTruthy();
    const zd = screen.getByRole("link", { name: "Przygotuj ZD: Dostawca 1" });
    expect(zd.getAttribute("href")).toContain("supplierId=s1");
  });

  it("bez uprawnień do ZD nie pokazuje linków do Kreatora", () => {
    render(<StockWatchOffPlanBanner suppliers={[supplier(1)]} canPrepareZd={false} />);
    expect(screen.queryByRole("link", { name: /Przygotuj ZD/ })).toBeNull();
  });

  it("pokazuje 6 dostawców, resztę odsyła do Braków", () => {
    const many = Array.from({ length: 8 }, (_, i) => supplier(i + 1));
    render(<StockWatchOffPlanBanner suppliers={many} canPrepareZd />);
    expect(screen.getAllByRole("link", { name: /Przygotuj ZD/ })).toHaveLength(6);
    expect(screen.getByRole("link", { name: /\+2 w panelu Braki/ }).getAttribute("href")).toBe("/zakupy/braki");
  });

  it("przycisk telefonu przełącza listę (aria-expanded)", () => {
    render(<StockWatchOffPlanBanner suppliers={[supplier(1)]} canPrepareZd />);
    const btn = screen.getByRole("button", { name: "Pokaż" });
    expect(btn.getAttribute("aria-expanded")).toBe("false");
    fireEvent.click(btn);
    expect(screen.getByRole("button", { name: "Zwiń" }).getAttribute("aria-expanded")).toBe("true");
  });
});
