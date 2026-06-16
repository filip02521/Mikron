/**
 * @vitest-environment happy-dom
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { DepartmentBoardQuestionFilters } from "./DepartmentBoardSalesChrome";

describe("DepartmentBoardQuestionFilters", () => {
  afterEach(() => {
    cleanup();
  });

  it("wywołuje onChange po kliknięciu chipa", () => {
    const onChange = vi.fn();
    render(<DepartmentBoardQuestionFilters value="all" onChange={onChange} />);

    fireEvent.click(screen.getByRole("button", { name: "Bez odpowiedzi" }));
    expect(onChange).toHaveBeenCalledWith("open");
  });

  it("blokuje zmianę filtra gdy disabled", () => {
    const onChange = vi.fn();
    render(<DepartmentBoardQuestionFilters value="all" onChange={onChange} disabled />);

    fireEvent.click(screen.getByRole("button", { name: "Bez odpowiedzi" }));
    expect(onChange).not.toHaveBeenCalled();
  });
});
