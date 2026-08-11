import { describe, expect, it } from "vitest";
import {
  launchProgressMinRevealWaitMs,
  launchProgressStepFromElapsed,
  ZD_ESTIMATE_LAUNCH_STEP_MS,
} from "@/lib/orders/zd-estimate-launch-progress";

describe("launchProgressStepFromElapsed", () => {
  it("starts at 0 when scope not resolved", () => {
    expect(launchProgressStepFromElapsed(0)).toBe(0);
  });

  it("starts at 1 when scope already resolved", () => {
    expect(
      launchProgressStepFromElapsed(0, { scopeAlreadyResolved: true })
    ).toBe(1);
  });

  it("advances every stepMs without looping past last", () => {
    const opts = { scopeAlreadyResolved: true as const };
    expect(launchProgressStepFromElapsed(0, opts)).toBe(1);
    expect(
      launchProgressStepFromElapsed(ZD_ESTIMATE_LAUNCH_STEP_MS, opts)
    ).toBe(2);
    expect(
      launchProgressStepFromElapsed(ZD_ESTIMATE_LAUNCH_STEP_MS * 2, opts)
    ).toBe(3);
    expect(
      launchProgressStepFromElapsed(ZD_ESTIMATE_LAUNCH_STEP_MS * 9, opts)
    ).toBe(3);
  });
});

describe("launchProgressMinRevealWaitMs", () => {
  it("waits remaining min visible time", () => {
    expect(launchProgressMinRevealWaitMs(1000, 1500, 3200)).toBe(2700);
    expect(launchProgressMinRevealWaitMs(1000, 5000, 3200)).toBe(0);
  });
});
