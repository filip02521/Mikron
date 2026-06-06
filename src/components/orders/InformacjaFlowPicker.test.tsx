/**
 * @vitest-environment happy-dom
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { InformacjaFlowPicker } from "./InformacjaFlowPicker";

describe("InformacjaFlowPicker", () => {
  afterEach(() => {
    cleanup();
  });

  it("renderuje dwie ścieżki dla handlowca", () => {
    render(<InformacjaFlowPicker path="direct" onChange={vi.fn()} />);

    expect(screen.getByRole("radio", { name: /Informacja o dostępności/i })).toBeTruthy();
    expect(screen.getByRole("radio", { name: /Brak na stanie/i })).toBeTruthy();
    expect(screen.queryByRole("radio", { name: /Najpierw zamówienie u dostawcy/i })).toBeNull();
  });

  it("w panelu dziennym pokazuje trzecią ścieżkę via_panel", () => {
    render(
      <InformacjaFlowPicker path="direct" onChange={vi.fn()} includeViaPanel />
    );

    expect(screen.getByRole("radio", { name: /Najpierw zamówienie u dostawcy/i })).toBeTruthy();
    expect(screen.getAllByRole("radio")).toHaveLength(3);
  });

  it("zaznacza aktywną ścieżkę i wywołuje onChange", () => {
    const onChange = vi.fn();
    render(<InformacjaFlowPicker path="direct" onChange={onChange} />);

    const stockOut = screen.getByRole("radio", { name: /Brak na stanie/i });
    expect(screen.getByRole("radio", { name: /Informacja o dostępności/i }).getAttribute("aria-checked")).toBe(
      "true"
    );
    expect(stockOut.getAttribute("aria-checked")).toBe("false");

    fireEvent.click(stockOut);
    expect(onChange).toHaveBeenCalledWith("stock_out");
  });

  it("nie reaguje gdy disabled", () => {
    const onChange = vi.fn();
    render(<InformacjaFlowPicker path="direct" onChange={onChange} disabled />);

    fireEvent.click(screen.getByRole("radio", { name: /Brak na stanie/i }));
    expect(onChange).not.toHaveBeenCalled();
  });
});
