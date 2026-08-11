/**
 * @vitest-environment happy-dom
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  scrollZdEstimateIntoView,
  scrollZdEstimateWhenReady,
} from "@/lib/orders/zd-estimate-launch-scroll";

describe("zd-estimate-launch-scroll", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    document.body.innerHTML = "";
  });

  it("scrolls scrollable parent instead of only window", () => {
    const main = document.createElement("main");
    Object.defineProperty(main, "clientHeight", { value: 200, configurable: true });
    Object.defineProperty(main, "scrollHeight", { value: 2000, configurable: true });
    main.style.overflowY = "auto";
    main.scrollTop = 0;
    const scrollTo = vi.fn();
    main.scrollTo = scrollTo as unknown as typeof main.scrollTo;

    const el = document.createElement("div");
    el.id = "zd-estimate-launch-focus";
    // Simulate layout below the fold inside main
    el.getBoundingClientRect = () =>
      ({
        top: 400,
        bottom: 500,
        height: 100,
        left: 0,
        right: 0,
        width: 100,
        x: 0,
        y: 400,
        toJSON: () => ({}),
      }) as DOMRect;
    main.getBoundingClientRect = () =>
      ({
        top: 0,
        bottom: 200,
        height: 200,
        left: 0,
        right: 0,
        width: 100,
        x: 0,
        y: 0,
        toJSON: () => ({}),
      }) as DOMRect;

    document.body.appendChild(main);
    main.appendChild(el);

    expect(scrollZdEstimateIntoView("zd-estimate-launch-focus", { behavior: "auto" })).toBe(
      true
    );
    expect(scrollTo).toHaveBeenCalled();
    const arg = scrollTo.mock.calls[0]?.[0] as { top: number };
    expect(arg.top).toBeGreaterThan(0);
  });

  it("returns false when missing", () => {
    expect(scrollZdEstimateIntoView("missing")).toBe(false);
  });

  it("retries whenReady until present", async () => {
    vi.useFakeTimers();
    const cancel = scrollZdEstimateWhenReady("late-el", {
      maxAttempts: 3,
      delayMs: 50,
    });
    const el = document.createElement("div");
    el.id = "late-el";
    el.scrollIntoView = vi.fn();
    document.body.appendChild(el);
    await vi.advanceTimersByTimeAsync(60);
    expect(el.scrollIntoView).toHaveBeenCalled();
    cancel();
    vi.useRealTimers();
  });
});
