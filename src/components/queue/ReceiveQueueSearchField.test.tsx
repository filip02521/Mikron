/**
 * @vitest-environment happy-dom
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { ReceiveQueueSearchField } from "./ReceiveQueueSearchField";

describe("ReceiveQueueSearchField", () => {
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it("nie zgłasza pustej frazy przy montowaniu, ale zgłasza ją po wyczyszczeniu pola", () => {
    vi.useFakeTimers();
    const onChange = vi.fn();
    render(<ReceiveQueueSearchField onDebouncedChange={onChange} />);
    act(() => vi.advanceTimersByTime(300));
    expect(onChange).not.toHaveBeenCalled();

    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "abc" } });
    act(() => vi.advanceTimersByTime(300));
    expect(onChange).toHaveBeenLastCalledWith("abc");

    fireEvent.click(screen.getByRole("button", { name: "Wyczyść wyszukiwanie" }));
    act(() => vi.advanceTimersByTime(300));
    expect(onChange).toHaveBeenLastCalledWith("");
  });
});
