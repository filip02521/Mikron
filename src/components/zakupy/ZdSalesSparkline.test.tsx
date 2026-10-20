/**
 * @vitest-environment happy-dom
 */
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { ZdSalesSparkline } from "./ZdSalesSparkline";
import type { ZdSalesProfileLineMeta } from "@/lib/orders/zd-sales-profile";

const profile = (windows: number[]): ZdSalesProfileLineMeta => ({
  kind: "spike",
  windows,
  activeWindows: windows.filter((v) => v > 0).length,
  typicalMonthly: 40,
  currentMonthly: 104,
  rawSprzedazOkres: 104,
  prosbaPieces: 0,
  smoothing: false,
  applied: false,
  factor: 1,
});

describe("ZdSalesSparkline", () => {
  afterEach(() => cleanup());

  it("12 słupków, bieżące okno w akcencie, seria w etykiecie dla czytnika", () => {
    const { container } = render(
      <ZdSalesSparkline profile={profile([38, 47, 28, 0, 38, 54, 41, 32, 44, 50, 39, 104])} />
    );
    const bars = container.querySelectorAll("svg rect");
    expect(bars).toHaveLength(12);
    expect(bars[11]?.getAttribute("class")).toContain("fill-indigo-600");
    expect(bars[3]?.getAttribute("class")).toContain("fill-slate-300");
    expect(screen.getByRole("button").getAttribute("aria-label")).toContain("38, 47, 28, 0");
  });

  it("pusty profil nic nie rysuje", () => {
    const { container } = render(<ZdSalesSparkline profile={profile([])} />);
    expect(container.innerHTML).toBe("");
  });
});
