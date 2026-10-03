/**
 * @vitest-environment happy-dom
 */
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { ZdEstimateNotice } from "./ZdEstimateNotice";

describe("ZdEstimateNotice", () => {
  afterEach(() => cleanup());

  it("ostrzeżenie: zwinięte do tytułu, rozwija szczegóły i daje się zamknąć", () => {
    render(
      <ZdEstimateNotice tone="warning" title="Przelicz listę">
        <button type="button">Policz</button>
      </ZdEstimateNotice>,
    );
    expect(screen.getByText("Przelicz listę")).toBeTruthy();
    expect(screen.queryByText("Policz")).toBeNull();

    fireEvent.click(screen.getByRole("button", { expanded: false }));
    expect(screen.getByText("Policz")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: /Zamknij komunikat/ }));
    expect(screen.queryByText("Przelicz listę")).toBeNull();
  });

  it("błąd: rozwinięty i bez zamykania", () => {
    render(
      <ZdEstimateNotice tone="error" title="Kreator ZD zablokowany">
        Brak konfiguracji Subiekta.
      </ZdEstimateNotice>,
    );
    expect(screen.getByText("Brak konfiguracji Subiekta.")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Zamknij komunikat/ })).toBeNull();
  });
});
