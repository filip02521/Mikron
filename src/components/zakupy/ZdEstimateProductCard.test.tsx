/**
 * @vitest-environment happy-dom
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
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

  it("wykluczony towar: decyzja mówi to wprost", () => {
    renderCard({ status: { excluded: true, onRequest: false } });
    expect(screen.getByText("Wykluczony z ZD")).toBeTruthy();
  });
});
