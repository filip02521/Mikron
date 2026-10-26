/**
 * @vitest-environment happy-dom
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

const historyMock = vi.hoisted(() => vi.fn());
vi.mock("@/app/actions/zd-estimate", () => ({
  actionFetchZdEstimateProductHistory: historyMock,
  actionGetZdProductNote: vi.fn(async () => ({ ok: true, note: "" })),
  actionSaveZdProductNote: vi.fn(),
}));
import { ZdEstimateProductCard } from "./ZdEstimateProductCard";
import { computeZdPackOrderQty } from "@/lib/orders/zd-estimate-packaging";
import type { ManualZdEstimateLine } from "@/lib/orders/zd-estimate-manual";

const line = {
  tw_Id: 10,
  tw_Symbol: "ECO-GIPS-IV-25",
  tw_Nazwa: "Gips eco klasa IV 25 kg",
  celZapasu: 210,
  celZapasuTracked: 210,
  dostepne: 12,
  sprzedazDziennie: 7,
  pair: null,
  salesProfile: null,
} as unknown as ManualZdEstimateLine;

function renderCard(extra: Partial<Parameters<typeof ZdEstimateProductCard>[0]> = {}) {
  const props = {
    line,
    qty: computeZdPackOrderQty(188, 5, "worek", "packages", 36),
    openZdPieces: 50,
    extraPieces: 40,
    extraOnly: false,
    extrasPolicy: "sum" as const,
    leadDays: 9,
    status: { excluded: false, onRequest: false },
    position: { index: 2, total: 5 },
    onClose: vi.fn(),
    onPrev: vi.fn(),
    onNext: vi.fn(),
    actions: {},
    canMutate: true,
    ...extra,
  };
  render(<ZdEstimateProductCard {...props} />);
  return props;
}

describe("ZdEstimateProductCard", () => {
  afterEach(() => cleanup());
  beforeEach(() =>
    historyMock.mockResolvedValue({ sales: { ok: true, rows: [], truncated: false }, purchases: { ok: true, rows: [] } })
  );

  it("zdanie decyzji z paletami, zapas vs dostawa i kroki „dlaczego tyle”", () => {
    renderCard();
    expect(screen.getByText("Na ZD: 72 × worek = 360 szt · 2 pełne palety")).toBeTruthy();
    expect(screen.getByText(/zabraknie przed dostawą/)).toBeTruthy();
    expect(screen.getByText(/Brak do celu/)).toBeTruthy();
    expect(screen.getByText(/Pełne palety po 36/)).toBeTruthy();
    expect(screen.getByText("3 / 5")).toBeTruthy();
  });

  it("← / → przechodzą między towarami, Esc zamyka", () => {
    const p = renderCard();
    fireEvent.keyDown(window, { key: "ArrowRight" });
    fireEvent.keyDown(window, { key: "ArrowLeft" });
    vi.useFakeTimers();
    fireEvent.keyDown(window, { key: "Escape" });
    vi.runAllTimers();
    vi.useRealTimers();
    expect(p.onNext).toHaveBeenCalledTimes(1);
    expect(p.onPrev).toHaveBeenCalledTimes(1);
    expect(p.onClose).toHaveBeenCalledTimes(1);
  });

  it("okno otwarte nad kartą i przytrzymana strzałka nie przełączają towaru", () => {
    const p = renderCard();
    const dialog = document.createElement("div");
    const input = document.createElement("button");
    dialog.appendChild(input);
    document.body.appendChild(dialog);
    fireEvent.keyDown(input, { key: "ArrowRight" });
    fireEvent.keyDown(input, { key: "Escape" });
    fireEvent.keyDown(window, { key: "ArrowRight", repeat: true });
    dialog.remove();
    expect(p.onNext).not.toHaveBeenCalled();
    expect(p.onClose).not.toHaveBeenCalled();
  });

  it("wykluczony towar: decyzja mówi to wprost", () => {
    renderCard({ status: { excluded: true, onRequest: false } });
    expect(screen.getByText("Wykluczony z ZD")).toBeTruthy();
  });

  it("pokazuje nasze zakupy, kto kupuje i ostatnie sprzedaże", async () => {
    historyMock.mockResolvedValueOnce({
      sales: {
        ok: true,
        truncated: false,
        rows: [
          { rola: "fs", dokNr: "FS 7", date: "2026-10-01", khId: 1, khSymbol: "LAB", khName: "Lab Ortho", pieces: 30 },
          { rola: "fs", dokNr: "FS 3", date: "2026-06-01", khId: 1, khSymbol: "LAB", khName: "Lab Ortho", pieces: 20 },
          { rola: "pa", dokNr: "PA 1", date: "2026-05-01", khId: 3306, khSymbol: "PARAGON", khName: "PARAGON", pieces: 2 },
        ],
      },
      purchases: {
        ok: true,
        rows: [
          { twId: 10, dokNr: "ZD 41/2026", date: "2026-09-01", qty: 36, priceNet: 52.5, fzDate: "2026-09-12", fzNr: "FZ 7/2026", fzCount: 2 },
          { twId: 10, dokNr: "ZD 50/2026", date: "2026-10-05", qty: 10, priceNet: 52.5, fzDate: null, fzNr: null, fzCount: 0, zdDone: false },
          { twId: 10, dokNr: "ZD 30/2026", date: "2026-08-05", qty: 10, priceNet: 52.5, fzDate: null, fzNr: null, fzCount: 0, zdDone: true },
        ],
      },
    });
    renderCard();
    expect(await screen.findByText("ZD 41/2026")).toBeTruthy();
    // Data w wierszu to wpis faktury; ZD z datą zamówienia pod spodem; ZD bez FZ — „bez faktury”.
    expect(screen.getByText("FZ 7/2026")).toBeTruthy();
    expect(screen.getByText("12.09.2026")).toBeTruthy();
    expect(screen.getByText("+1 kolejna")).toBeTruthy();
    expect(screen.getByText(/z 01\.09\.2026/)).toBeTruthy();
    expect(screen.getByText("w drodze")).toBeTruthy();
    expect(screen.getByText("zrealizowane, FZ niepowiązana")).toBeTruthy();
    expect(screen.getByText("36 worek")).toBeTruthy();
    expect(screen.getAllByText("= 180 szt").length).toBeGreaterThan(0);
    expect(screen.getByText(/Kupuje głównie Lab Ortho \(96%\)/)).toBeTruthy();
    expect(screen.getByText("Paragon")).toBeTruthy();
    expect(screen.queryByText("W drodze (ZD)")).toBeNull();
  });

  it("po fakturze jeden klient bierze całą dostawę: podpowiedź „na prośbę” z przyciskiem oznaczenia", async () => {
    historyMock.mockResolvedValueOnce({
      sales: {
        ok: true,
        truncated: false,
        rows: [{ rola: "fs", dokNr: "FS 9", date: "2026-08-03", khId: 7, khSymbol: "GABINET", khName: "Gabinet Testowy", pieces: 180 }],
      },
      purchases: { ok: true, rows: [{ twId: 10, dokNr: "ZD 41/2026", date: "2026-07-20", qty: 36, priceNet: null, fzDate: "2026-07-23", fzNr: "FZ 7", fzCount: 1 }] },
    });
    const onMarkOnRequest = vi.fn();
    renderCard({ actions: { onMarkOnRequest } });
    expect(await screen.findByText("Wygląda na towar na prośbę")).toBeTruthy();
    expect(screen.getByText(/1 z 1 dostaw .* jeden klient \(najczęściej Gabinet Testowy\) - to 100% sprzedaży\./)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Oznacz „tylko na prośbę”" }));
    expect(onMarkOnRequest).toHaveBeenCalledOnce();
  });

  it("błąd sprzedaży nie psuje zakupów ani reszty karty", async () => {
    historyMock.mockResolvedValueOnce({
      sales: { ok: false, message: "brak hosta" },
      purchases: { ok: true, rows: [] },
    });
    renderCard();
    expect(await screen.findByText(/Sprzedaż niedostępna: brak hosta/)).toBeTruthy();
    expect(screen.getByText(/Brak ZD z tym towarem/)).toBeTruthy();
    expect(screen.getByText(/Brak do celu/)).toBeTruthy();
  });

  it("para: stan pokazany osobno dla sztuk i paczek, plus pokrycie pary", () => {
    renderCard({
      line: {
        ...line,
        pair: { role: "pack", unitsPerPack: 5, pieceDostepne: 7, packDostepne: 3, coverSzt: 72, partnerMissing: false },
      } as unknown as ManualZdEstimateLine,
    });
    expect(screen.getByText("Dostępne - sztuki")).toBeTruthy();
    expect(screen.getByText("Dostępne - worek (×5)")).toBeTruthy();
    expect(screen.getByText("15 szt")).toBeTruthy();
    expect(screen.getByText("Pokrycie pary (z ZD)")).toBeTruthy();
  });
});
