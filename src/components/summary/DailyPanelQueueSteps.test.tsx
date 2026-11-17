/**
 * @vitest-environment happy-dom
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { DailyPanelQueueSteps } from "./DailyPanelQueueSteps";

afterEach(cleanup);

const counts = { send: 2, order: 3, early: 4, shift: 2, manual: 0, stockOut: 1, prosby: 6 };

describe("DailyPanelQueueSteps", () => {
  it("kroki grup dostawców i próśb z licznikami; bez kroku z zerem i bez Zamów wcześniej (poza kolejką)", () => {
    render(<DailyPanelQueueSteps counts={counts} />);
    expect(screen.getAllByRole("link").map((a) => [a.textContent, a.getAttribute("href")])).toEqual([
      ["Do wysłania(2)", "#kolejka-dostawcy-send"],
      ["Do zamówienia(3)", "#kolejka-dostawcy-order"],
      ["Do przesunięcia(2)", "#kolejka-dostawcy-shift"],
      ["Brak na stanie(1)", "#kolejka-brak-na-stanie"],
      ["Prośby handlowców(6)", "#kolejka-prosby"],
    ]);
  });

  it("jedna aktywna sekcja — bez paska kroków", () => {
    const { container } = render(<DailyPanelQueueSteps counts={{ ...counts, order: 0, shift: 0, stockOut: 0, prosby: 0 }} />);
    expect(container.innerHTML).toBe("");
  });

  it("klik kroku woła onNavigate (zdjęcie filtra źródła)", () => {
    const onNavigate = vi.fn();
    render(<DailyPanelQueueSteps counts={counts} onNavigate={onNavigate} />);
    fireEvent.click(screen.getByRole("link", { name: /Do przesunięcia/ }));
    expect(onNavigate).toHaveBeenCalledTimes(1);
    expect(onNavigate.mock.calls[0][0]).toBe("shift");
  });
});
