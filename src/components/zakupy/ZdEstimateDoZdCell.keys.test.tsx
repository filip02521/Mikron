/**
 * @vitest-environment happy-dom
 */
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { focusAdjacentZdQtyInput, zdQtyArrowNext } from "./ZdEstimateDoZdCell";

describe("zdQtyArrowNext", () => {
  it("krok 1: ±1, nie schodzi poniżej zera", () => {
    expect(zdQtyArrowNext(3, 1, 1)).toBe(4);
    expect(zdQtyArrowNext(3, -1, 1)).toBe(2);
    expect(zdQtyArrowNext(0, -1, 1)).toBe(0);
  });

  it("krok opakowania: dociąga do wielokrotności w kierunku strzałki", () => {
    expect(zdQtyArrowNext(0, 1, 12)).toBe(12);
    expect(zdQtyArrowNext(13, 1, 12)).toBe(24);
    expect(zdQtyArrowNext(13, -1, 12)).toBe(12);
    expect(zdQtyArrowNext(12, -1, 12)).toBe(0);
  });

  it("Shift (×10) przesuwa o 10 kroków od bieżącej wartości", () => {
    expect(zdQtyArrowNext(22, -1, 1, 10)).toBe(12);
    expect(zdQtyArrowNext(22, 1, 1, 10)).toBe(32);
    expect(zdQtyArrowNext(5, -1, 1, 10)).toBe(0);
    expect(zdQtyArrowNext(13, 1, 12, 10)).toBe(132);
  });
});

describe("focusAdjacentZdQtyInput", () => {
  afterEach(() => cleanup());

  it("przechodzi do pola następnego / poprzedniego wiersza, pomija wyłączone", () => {
    render(
      <table>
        <tbody>
          <tr><td><input aria-label="a" className="zd-est-dozd-input" /></td><td><button type="button">x</button></td></tr>
          <tr><td><input aria-label="b" className="zd-est-dozd-input" disabled /></td></tr>
          <tr><td><input aria-label="c" className="zd-est-dozd-input" /></td></tr>
        </tbody>
      </table>
    );
    const a = screen.getByLabelText("a") as HTMLInputElement;
    const c = screen.getByLabelText("c") as HTMLInputElement;
    a.focus();
    expect(focusAdjacentZdQtyInput(a, 1)).toBe(true);
    expect(document.activeElement).toBe(c);
    expect(focusAdjacentZdQtyInput(c, 1)).toBe(false);
    expect(focusAdjacentZdQtyInput(c, -1)).toBe(true);
    expect(document.activeElement).toBe(a);
  });
});
