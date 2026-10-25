/**
 * @vitest-environment happy-dom
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { QueueStatus } from "./TeethPanelKolejkaView";
import { TeethReceiveSummaryBand } from "./TeethReceiveSummaryBand";

afterEach(cleanup);

// Zdania stanu zastąpiły kafelki z liczbami — pilnujemy, że niosą te same fakty.
describe("QueueStatus", () => {
  it("pokazuje kolejkę, gotowe, do uzupełnienia i najdłuższe czekanie", () => {
    const onShow = vi.fn();
    render(<QueueStatus orders={4} ready={1} needsFix={2} oldestDays={8} onShowNeedsFix={onShow} />);
    expect(screen.getByText(/4 prośby w kolejce, 1 gotowa do zamówienia/)).toBeTruthy();
    expect(screen.getByText(/2 do uzupełnienia - brak lub niepełna lista/)).toBeTruthy();
    expect(screen.getByText(/Najdłużej czeka:/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Pokaż 2 do uzupełnienia" }));
    expect(onShow).toHaveBeenCalledOnce();
  });

  it("bez braków nie pokazuje akcji filtra", () => {
    render(<QueueStatus orders={1} ready={1} needsFix={0} oldestDays={0} onShowNeedsFix={() => {}} />);
    expect(screen.getByText(/Wszystkie listy zębów są kompletne/)).toBeTruthy();
    expect(screen.getByText(/Najdłużej czeka: od dziś/)).toBeTruthy();
    expect(screen.queryByRole("button")).toBeNull();
  });
});

describe("TeethReceiveSummaryBand", () => {
  it("przy pustej kolejce nic nie renderuje (mówi to pusty stan)", () => {
    const { container } = render(
      <TeethReceiveSummaryBand summary={{ activeCount: 0, partialCount: 0 }} queueCount={0} />,
    );
    expect(container.textContent).toBe("");
  });

  it("pokazuje liczbę do przyjęcia i częściowe", () => {
    render(<TeethReceiveSummaryBand summary={{ activeCount: 3, partialCount: 1 }} queueCount={3} />);
    expect(screen.getByText(/3 pozycje do przyjęcia/)).toBeTruthy();
    expect(screen.getByText(/1 częściowo/)).toBeTruthy();
  });
});
