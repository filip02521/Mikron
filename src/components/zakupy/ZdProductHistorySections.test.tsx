/**
 * @vitest-environment happy-dom
 */
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { ZdProductMovementSection, ZdProductSalesSections, type ZdProductHistoryState } from "./ZdProductHistorySections";
import type { ZdProductSaleRow } from "@/lib/orders/zd-product-history";

afterEach(cleanup);

const sale = (date: string, khId: number, khName: string, pieces: number, dokNr: string): ZdProductSaleRow => ({
  rola: "fs",
  dokNr,
  date,
  khId,
  khSymbol: `K${khId}`,
  khName,
  pieces,
});

const state = (rows: ZdProductSaleRow[]): ZdProductHistoryState => ({
  status: "ok",
  sales: { ok: true, rows, truncated: false },
  purchases: { ok: true, rows: [] },
});

const rows = [
  sale("2026-06-10", 1, "Klinika Alfa", 5, "FS 1/2026"),
  sale("2026-10-20", 2, "Gabinet Beta", 3, "FS 2/2026"),
  sale("2026-10-27", 3, "Gabinet Gamma", 2, "FS 3/2026"),
];
const wide = { from: "2026-01-01", to: "2026-11-09" };
const narrow = { from: "2026-10-01", to: "2026-11-09" };

describe("filtry historii po zmianie zakresu", () => {
  it("sprzedaż: klient spoza nowego zakresu nie zostawia pustej listy bez chipa do zdjęcia", () => {
    const { rerender } = render(<ZdProductSalesSections state={state(rows)} titleId="t" range={wide} />);
    fireEvent.click(screen.getByTitle("Pokaż tylko dokumenty: Klinika Alfa"));
    expect(screen.getByRole("button", { name: "Usuń filtr klienta Klinika Alfa" })).toBeTruthy();
    rerender(<ZdProductSalesSections state={state(rows)} titleId="t" range={narrow} />);
    expect(screen.queryByText("Brak dokumentów dla wybranych filtrów.")).toBeNull();
    expect(screen.getByText("FS 2/2026")).toBeTruthy();
  });

  it("ruch towaru: wybrany klient zostaje widoczny w polu wyboru, gdy w zakresie zostaje tylko on", () => {
    const { rerender } = render(<ZdProductMovementSection state={state(rows)} titleId="t" unitFor={() => ({ label: "szt", piecesPerUnit: null })} range={wide} />);
    fireEvent.change(screen.getByLabelText("Klient"), { target: { value: "Gabinet Beta" } });
    const onlyBeta = { from: "2026-10-15", to: "2026-10-22" };
    rerender(<ZdProductMovementSection state={state(rows)} titleId="t" unitFor={() => ({ label: "szt", piecesPerUnit: null })} range={onlyBeta} />);
    expect((screen.getByLabelText("Klient") as HTMLSelectElement).value).toBe("Gabinet Beta");
  });
});
