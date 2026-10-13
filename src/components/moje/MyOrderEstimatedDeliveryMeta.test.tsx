/**
 * @vitest-environment happy-dom
 */
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { MyOrderEstimatedDeliveryMeta } from "./MyOrderEstimatedDeliveryMeta";

const overdueRow = {
  timingLabel: "ok. 10.05.2026 (~5 dni rob.) · po terminie",
  zdFulfillment: null,
  zdEtaPending: false,
  zdEtaNoMatch: true,
};

describe("szacunek z historii w wierszu prośby", () => {
  afterEach(() => cleanup());

  it("zwinięty wiersz po minionym szacunku nie powtarza „Brak terminu” obok nagłówka", () => {
    const { container } = render(<MyOrderEstimatedDeliveryMeta row={overdueRow} hideWhenOverdue />);
    expect(container.textContent).toBe("");
  });

  it("po rozwinięciu (bez hideWhenOverdue) termin z historii zostaje", () => {
    render(<MyOrderEstimatedDeliveryMeta row={overdueRow} inline />);
    expect(screen.getByText("Brak terminu")).toBeTruthy();
  });
});
