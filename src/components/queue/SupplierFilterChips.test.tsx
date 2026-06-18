/**
 * @vitest-environment happy-dom
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { SupplierFilterChips } from "./SupplierFilterChips";

describe("SupplierFilterChips", () => {
  afterEach(() => {
    cleanup();
  });

  it("pokazuje syntetyczny chip dla dostawcy spoza listy kolejki", () => {
    render(
      <SupplierFilterChips
        chips={[{ key: "Ivoclar", count: 3 }]}
        value="Dostawca spoza listy"
        onChange={vi.fn()}
      />
    );

    expect(screen.getByRole("button", { name: /Dostawca spoza listy/i })).toBeTruthy();
    expect(screen.getByText("0")).toBeTruthy();
  });

  it("wywołuje onChange po wyczyszczeniu filtra", () => {
    const onChange = vi.fn();

    render(
      <SupplierFilterChips
        chips={[{ key: "Ivoclar", count: 3 }]}
        value="Ivoclar"
        onChange={onChange}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Wyczyść filtr" }));
    expect(onChange).toHaveBeenCalledWith("");
  });
});
