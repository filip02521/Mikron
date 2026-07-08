/**
 * @vitest-environment happy-dom
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import {
  DepartmentBoardQuestionFilters,
  DepartmentBoardTabBar,
} from "./DepartmentBoardSalesChrome";

const baseCounts = {
  all: 5,
  open: 2,
  answered: 3,
  unseen: 1,
  own_unseen: 1,
  mine: 2,
};

describe("DepartmentBoardQuestionFilters", () => {
  afterEach(() => {
    cleanup();
  });

  it("wywołuje onChange po kliknięciu chipa", () => {
    const onChange = vi.fn();
    render(<DepartmentBoardQuestionFilters value="all" onChange={onChange} counts={baseCounts} />);

    fireEvent.click(screen.getByRole("button", { name: /Bez odpowiedzi/i }));
    expect(onChange).toHaveBeenCalledWith("open");
  });

  it("blokuje zmianę filtra gdy disabled", () => {
    const onChange = vi.fn();
    render(
      <DepartmentBoardQuestionFilters
        value="all"
        onChange={onChange}
        counts={baseCounts}
        disabled
        disabledReason="Filtry zablokowane."
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /Bez odpowiedzi/i }));
    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByText("Filtry zablokowane.")).toBeTruthy();
  });

  it("pokazuje filtr nowych odpowiedzi i tylko moje", () => {
    const onChange = vi.fn();
    render(
      <DepartmentBoardQuestionFilters
        value="all"
        onChange={onChange}
        counts={baseCounts}
        showUnseen
        showMine
      />
    );

    expect(screen.getByRole("button", { name: /Nowe odpowiedzi/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /Moje z nową odpowiedzią/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /Tylko moje/i })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /Nowe odpowiedzi/i }));
    expect(onChange).toHaveBeenCalledWith("unseen");
  });

  it("pokazuje liczniki na wszystkich chipach filtra", () => {
    render(
      <DepartmentBoardQuestionFilters
        value="open"
        onChange={vi.fn()}
        counts={baseCounts}
        showUnseen
        showMine
      />
    );

    expect(screen.getByRole("button", { name: /Wszystkie/i }).textContent).toContain("5");
    expect(screen.getByRole("button", { name: /Bez odpowiedzi/i }).textContent).toContain("2");
    expect(screen.getByRole("button", { name: /Odpowiedziane/i }).textContent).toContain("3");
    expect(screen.getByRole("button", { name: /Tylko moje/i }).textContent).toContain("2");
  });

  it("pokazuje chip nowych odpowiedzi nawet gdy wyszukiwanie daje zero wyników", () => {
    render(
      <DepartmentBoardQuestionFilters
        value="all"
        onChange={vi.fn()}
        counts={{ ...baseCounts, unseen: 0 }}
        showUnseen
      />
    );

    expect(screen.getByRole("button", { name: /Nowe odpowiedzi/i })).toBeTruthy();
  });
});

describe("DepartmentBoardTabBar", () => {
  afterEach(() => {
    cleanup();
  });

  it("zawsze pokazuje liczniki na zakładkach", () => {
    render(
      <DepartmentBoardTabBar
        activeTab="announcements"
        onTabChange={vi.fn()}
        activeAnnouncements={4}
        totalQuestions={9}
        openQuestions={2}
      />
    );

    expect(screen.getByRole("tab", { name: /Ogłoszenia/i }).textContent).toContain("4");
    expect(screen.getByRole("tab", { name: /Pytania/i }).textContent).toContain("2");
  });
});
