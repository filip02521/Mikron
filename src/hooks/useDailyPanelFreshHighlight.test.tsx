/**
 * @vitest-environment happy-dom
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, render } from "@testing-library/react";

const ops = { freshHighlightUntil: 0, refreshGeneration: 0 };
vi.mock("@/components/operations/OperationsUpdatesContext", () => ({
  useOperationsUpdates: () => ops,
}));

import { useDailyPanelFreshHighlight } from "./useDailyPanelFreshHighlight";

let renders = 0;
function Probe() {
  renders++;
  return <span data-testid="v">{String(useDailyPanelFreshHighlight())}</span>;
}

describe("useDailyPanelFreshHighlight", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) =>
      setTimeout(() => cb(0), 16)
    );
    vi.stubGlobal("cancelAnimationFrame", (id: number) => clearTimeout(id));
    renders = 0;
  });
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("true po odświeżeniu, false po wygaśnięciu, bez ciągłych re-renderów", () => {
    ops.freshHighlightUntil = Date.now() + 3000;
    ops.refreshGeneration = 1;
    const { getByTestId } = render(<Probe />);
    act(() => {
      vi.advanceTimersByTime(20);
    });
    expect(getByTestId("v").textContent).toBe("true");

    const before = renders;
    act(() => {
      vi.advanceTimersByTime(2000);
    });
    // Brak interwału — w trakcie podświetlenia nic się nie przerenderowuje.
    expect(renders).toBe(before);

    act(() => {
      vi.advanceTimersByTime(1100);
    });
    expect(getByTestId("v").textContent).toBe("false");
  });
});
