/**
 * @vitest-environment happy-dom
 */
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { MyOrderRequestProgressBar } from "./MyOrderRequestProgressBar";

describe("oś postępu prośby", () => {
  afterEach(() => cleanup());

  it("pokazuje każdy krok z podpisem i datą, bieżący krok oznaczony, łącznik między krokami", () => {
    const { container } = render(
      <MyOrderRequestProgressBar
        track={{
          accent: "default",
          steps: [
            { id: "a", label: "Prośba", state: "done", date: "12.08.2026" },
            { id: "b", label: "Zamówienie", state: "current", date: "13.08.2026" },
            { id: "c", label: "Dostawa", state: "upcoming" },
            { id: "d", label: "Odbiór", state: "upcoming" },
          ],
        }}
      />
    );

    for (const text of ["Prośba", "12.08.2026", "Zamówienie", "13.08.2026", "Dostawa", "Odbiór"]) {
      expect(screen.getByText(text)).toBeTruthy();
    }
    expect(container.querySelector('[aria-current="step"]')?.textContent).toBe("2");
    expect(container.querySelectorAll("li")).toHaveLength(4);
    // Łącznik po każdym kroku poza ostatnim.
    expect(container.querySelectorAll("li > span[aria-hidden]")).toHaveLength(3);
  });
});
