/**
 * @vitest-environment happy-dom
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

const a = {
  get: vi.fn(),
  mark: vi.fn(),
  clear: vi.fn(),
  exclude: vi.fn(),
  restore: vi.fn(),
  minUpsert: vi.fn(),
  minDelete: vi.fn(),
  suggest: vi.fn(),
  loadOlder: vi.fn(),
};
const historyState = { current: { status: "loading" } as Record<string, unknown> };
vi.mock("@/app/actions/zd-estimate", () => ({
  actionGetZdProductSettings: (...x: unknown[]) => a.get(...x),
  actionMarkZdEstimateOnRequest: (...x: unknown[]) => a.mark(...x),
  actionClearZdEstimateOnRequest: (...x: unknown[]) => a.clear(...x),
  actionExcludeZdEstimateProduct: (...x: unknown[]) => a.exclude(...x),
  actionRestoreZdEstimateProduct: (...x: unknown[]) => a.restore(...x),
  actionUpsertZdEstimateMinStock: (...x: unknown[]) => a.minUpsert(...x),
  actionDeleteZdEstimateMinStock: (...x: unknown[]) => a.minDelete(...x),
  actionUpsertZdEstimatePackaging: vi.fn(),
  actionDeleteZdEstimatePackaging: vi.fn(),
  actionGetZdProductNote: vi.fn(async () => ({ ok: true, note: "" })),
  actionSaveZdProductNote: vi.fn(),
}));
vi.mock("@/app/actions/subiekt", () => ({ actionSubiektSuggestProducts: (...x: unknown[]) => a.suggest(...x) }));
vi.mock("@/components/zakupy/ZdEstimateProductCard", () => ({
  useProductHistory: () => historyState.current,
  useOlderPurchases: (_tw: number, _pair: unknown, base: unknown) => ({ history: base, older: { status: "idle" }, loadOlder: () => a.loadOlder() }),
}));

import { ZdProductSettingsPalette } from "./ZdProductSettings";

afterEach(() => {
  cleanup();
  historyState.current = { status: "loading" };
  Object.values(a).forEach((f) => f.mockReset());
});

const product = { tw_Id: 4012, tw_Symbol: "MULTI 600", tw_Nazwa: "Mikrosilnik MULTI 600", tw_IdGrupa: 7, grt_Nazwa: "Saeyang", tw_PLU: "4012" };
const settings = (over = {}) => ({
  ok: true,
  settings: { twId: 4012, mode: "normal", modeNote: "", packaging: null, minStockSzt: null, pair: null, note: "", ...over },
});

describe("ustawienia towaru z panelu dziennego", () => {
  it("szukanie, strzałki + Enter, potem tryb „Tylko na prośbę” z grupą z Subiekta i odświeżenie", async () => {
    a.suggest.mockResolvedValue({ ok: true, items: [product, { ...product, tw_Id: 2, tw_Nazwa: "Inny" }] });
    a.get.mockResolvedValueOnce(settings()).mockResolvedValueOnce(settings({ mode: "onRequest" }));
    a.mark.mockResolvedValue({ ok: true });
    render(<ZdProductSettingsPalette open onClose={() => {}} canEdit />);
    const input = screen.getByLabelText("Szukaj towaru");
    fireEvent.change(input, { target: { value: "MULTI" } });
    await screen.findAllByRole("option");
    fireEvent.keyDown(input, { key: "ArrowDown" });
    fireEvent.keyDown(input, { key: "ArrowUp" });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(await screen.findByText("Kreator liczy zapas z tempa sprzedaży, jak zwykle.")).toBeTruthy();
    expect(a.get).toHaveBeenCalledWith({ twId: 4012 });
    fireEvent.click(screen.getByRole("button", { name: "Tylko na prośbę" }));
    await waitFor(() =>
      expect(a.mark).toHaveBeenCalledWith({ subiektTwId: 4012, twSymbol: "MULTI 600", twNazwa: "Mikrosilnik MULTI 600", grtId: 7, grtNazwa: "Saeyang" })
    );
    expect(await screen.findByText("Bez prośby poza Do ZD; z prośbą - tylko ilość z prośby.")).toBeTruthy();
  });

  it("symbol małymi literami szuka po symbolu i nazwie; same cyfry także po kodzie Mikran, dokładny symbol pierwszy", async () => {
    a.suggest.mockImplementation(async (q: string, field: string) =>
      field === "plu"
        ? { ok: true, items: [{ ...product, tw_Id: 9, tw_Symbol: "X-1", tw_Nazwa: "Po kodzie", tw_PLU: "200224" }] }
        : { ok: true, items: [{ ...product, tw_Symbol: q.toUpperCase() }] }
    );
    render(<ZdProductSettingsPalette open onClose={() => {}} canEdit />);
    const input = screen.getByLabelText("Szukaj towaru");
    fireEvent.change(input, { target: { value: "multi" } });
    await screen.findAllByRole("option");
    expect(a.suggest.mock.calls).toEqual([["multi", "combined"]]);
    a.suggest.mockClear();
    fireEvent.change(input, { target: { value: "200224" } });
    await waitFor(() => expect(a.suggest.mock.calls).toEqual([["200224", "plu"], ["200224", "combined"]]));
    await waitFor(() => expect(screen.getAllByRole("option")).toHaveLength(2));
    const [first, second] = screen.getAllByRole("option");
    expect(first!.textContent).toContain("Symbol: 200224");
    expect(second!.textContent).toContain("Po kodzie");
  });

  it("po wyborze: nagłówek z nazwą i symbolem, zamawianie i notatka zawsze, historia w zakładkach", async () => {
    a.suggest.mockResolvedValue({ ok: true, items: [{ ...product, tw_Stan: 3 }] });
    a.get.mockResolvedValue(settings({ packaging: { unitsPerPackage: 10, packageLabel: "kart.", documentUnitMode: "packages" } }));
    render(<ZdProductSettingsPalette open onClose={() => {}} canEdit />);
    fireEvent.change(screen.getByLabelText("Szukaj towaru"), { target: { value: "MULTI" } });
    fireEvent.click((await screen.findAllByRole("option"))[0]!.querySelector("button")!);
    expect(await screen.findByText("1 kart. = 10 szt")).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Mikrosilnik MULTI 600" })).toBeTruthy();
    expect(screen.getByText("Symbol MULTI 600 · kod Mikran 4012 · Saeyang · na stanie 3 szt")).toBeTruthy();
    expect(screen.getByText("Wczytuję zakupy…")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Sprzedaż" }));
    expect(screen.getByText("Wczytuję sprzedaż z Subiekta…")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Ruch towaru" }));
    expect(screen.getByText("Wczytuję ruch towaru…")).toBeTruthy();
    expect(screen.getByText("Minimalny stan")).toBeTruthy();
    expect(screen.getByText("Para")).toBeTruthy();
  });

  it("z wykluczonego do „Normalnie” przywraca; błąd zapisu widać w oknie", async () => {
    a.suggest.mockResolvedValue({ ok: true, items: [product] });
    a.get.mockResolvedValue(settings({ mode: "excluded" }));
    a.restore.mockResolvedValue({ ok: false, message: "Brak uprawnień." });
    render(<ZdProductSettingsPalette open onClose={() => {}} canEdit />);
    fireEvent.change(screen.getByLabelText("Szukaj towaru"), { target: { value: "MULTI" } });
    fireEvent.click((await screen.findAllByRole("option"))[0]!.querySelector("button")!);
    await screen.findByText(/Nigdy na ZD/);
    fireEvent.click(screen.getByRole("button", { name: "Normalnie" }));
    await waitFor(() => expect(a.restore).toHaveBeenCalledWith(4012));
    expect(await screen.findByText("Brak uprawnień.")).toBeTruthy();
  });

  it("zakres dłuższy niż 12 miesięcy dociąga starsze zakupy z kopii ZD", async () => {
    historyState.current = { status: "ok", sales: { ok: true, rows: [], truncated: false }, purchases: { ok: true, rows: [] } };
    a.suggest.mockResolvedValue({ ok: true, items: [product] });
    a.get.mockResolvedValue(settings());
    render(<ZdProductSettingsPalette open onClose={() => {}} canEdit />);
    fireEvent.change(screen.getByLabelText("Szukaj towaru"), { target: { value: "MULTI" } });
    fireEvent.click((await screen.findAllByRole("option"))[0]!.querySelector("button")!);
    await screen.findByText(/Kreator liczy zapas/);
    expect(a.loadOlder).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "cała historia" }));
    await waitFor(() => expect(a.loadOlder).toHaveBeenCalled());
  });
});
