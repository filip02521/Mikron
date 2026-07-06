/**
 * @vitest-environment happy-dom
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { DepartmentBoardQuestionFilters } from "./DepartmentBoardSalesChrome";

const baseCounts = {
  all: 5,
  open: 2,
  answered: 3,
  unseen: 1,
  own_unseen: 0,
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
    expect(screen.getByRole("button", { name: /Tylko moje/i })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /Nowe odpowiedzi/i }));
    expect(onChange).toHaveBeenCalledWith("unseen");
  });
});
