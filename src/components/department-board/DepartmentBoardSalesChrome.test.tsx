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
  closed: 0,
  unseen: 1,
  own_unseen: 1,
  mine: 2,
};

describe("DepartmentBoardQuestionFilters", () => {
  afterEach(() => {
    cleanup();
  });

  it("wywołuje onChange po kliknięciu chipa statusu", () => {
    const onChange = vi.fn();
    render(
      <DepartmentBoardQuestionFilters value="all" onChange={onChange} counts={baseCounts} />
    );

    fireEvent.click(screen.getByRole("button", { name: /Czekają/i }));
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

    fireEvent.click(screen.getByRole("button", { name: /Czekają/i }));
    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByText("Filtry zablokowane.")).toBeTruthy();
  });

  it("sales: pokazuje Nowe i Moje w grupie Dla Ciebie, bez długiego Moje z nową", () => {
    const onChange = vi.fn();
    render(
      <DepartmentBoardQuestionFilters
        domain="sales"
        value="all"
        onChange={onChange}
        counts={baseCounts}
        showUnseen
        showMine
      />
    );

    expect(screen.getByText("Status")).toBeTruthy();
    expect(screen.getByText("Dla Ciebie")).toBeTruthy();
    expect(screen.getByRole("button", { name: /Nowe/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /^Moje/i })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Moje z nową odpowiedzią/i })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /Nowe/i }));
    expect(onChange).toHaveBeenCalledWith("unseen");
  });

  it("sales: own_unseen z URL pokazuje pasek z powrotem do wszystkich", () => {
    const onChange = vi.fn();
    render(
      <DepartmentBoardQuestionFilters
        domain="sales"
        value="own_unseen"
        onChange={onChange}
        counts={baseCounts}
        showMine
      />
    );

    expect(screen.getByText(/Widok: Twoje pytania z nową odpowiedzią/i)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /Pokaż wszystkie/i }));
    expect(onChange).toHaveBeenCalledWith("all");
  });

  it("pokazuje liczniki na chipach statusu i Moje", () => {
    render(
      <DepartmentBoardQuestionFilters
        domain="sales"
        value="open"
        onChange={vi.fn()}
        counts={baseCounts}
        showUnseen
        showMine
      />
    );

    expect(screen.getByRole("button", { name: /Aktywne/i }).textContent).toContain("5");
    expect(screen.getByRole("button", { name: /Czekają/i }).textContent).toContain("2");
    expect(screen.getByRole("button", { name: /Z odpowiedzią/i }).textContent).toContain("3");
    expect(screen.getByRole("button", { name: /^Moje/i }).textContent).toContain("2");
  });

  it("panel: tylko status, bez grupy Dla Ciebie", () => {
    render(
      <DepartmentBoardQuestionFilters
        domain="panel"
        value="all"
        onChange={vi.fn()}
        counts={baseCounts}
        showUnseen
        showMine
      />
    );

    expect(screen.queryByText("Dla Ciebie")).toBeNull();
    expect(screen.queryByRole("button", { name: /^Nowe$/i })).toBeNull();
    expect(screen.getByRole("button", { name: /Aktywne/i })).toBeTruthy();
  });

  it("pokazuje chip Nowe nawet gdy wyszukiwanie daje zero wyników", () => {
    render(
      <DepartmentBoardQuestionFilters
        domain="sales"
        value="all"
        onChange={vi.fn()}
        counts={{ ...baseCounts, unseen: 0 }}
        showUnseen
      />
    );

    expect(screen.getByRole("button", { name: /Nowe/i })).toBeTruthy();
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
