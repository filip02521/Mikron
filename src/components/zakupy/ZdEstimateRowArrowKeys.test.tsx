/**
 * @vitest-environment happy-dom
 */
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { handleZdEstimateRowArrowKeys } from "./ZdEstimateTableRow";

function Table() {
  const name = (n: string) => (
    <button type="button" className="zd-est-product-name--link">
      {n}
    </button>
  );
  return (
    <table>
      <tbody onKeyDown={handleZdEstimateRowArrowKeys}>
        <tr><td>{name("A")}</td><td><input aria-label="qty" /></td></tr>
        <tr aria-hidden><td /></tr>
        <tr><td>{name("B")}</td></tr>
      </tbody>
    </table>
  );
}

describe("handleZdEstimateRowArrowKeys", () => {
  afterEach(() => cleanup());

  it("↓/↑ przeskakuje na nazwę sąsiedniego towaru, pomija wiersze bez nazwy", () => {
    render(<Table />);
    const a = screen.getByText("A");
    a.focus();
    fireEvent.keyDown(a, { key: "ArrowDown" });
    expect(document.activeElement).toBe(screen.getByText("B"));
    fireEvent.keyDown(screen.getByText("B"), { key: "ArrowUp" });
    expect(document.activeElement).toBe(a);
  });

  it("w polu ilości strzałki zostają polu", () => {
    render(<Table />);
    const input = screen.getByLabelText("qty");
    input.focus();
    fireEvent.keyDown(input, { key: "ArrowDown" });
    expect(document.activeElement).toBe(input);
  });
});
