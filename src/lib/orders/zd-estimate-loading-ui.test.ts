/**
 * @vitest-environment node
 */
import { describe, expect, it } from "vitest";
import {
  formatZdEstimateElapsedCompact,
  resolveZdEstimateLoadingBarPct,
  resolveZdEstimateTimedLoadingBarPct,
  resolveZdEstimateLoadingStatusTone,
  resolveZdEstimateLoadingStepVisual,
  zdEstimateLoadingElapsedLabel,
} from "@/lib/orders/zd-estimate-loading-ui";

describe("zd-estimate-loading-ui", () => {
  it("elapsed compact — sekundy i mm:ss", () => {
    expect(formatZdEstimateElapsedCompact(0)).toBe("0s");
    expect(formatZdEstimateElapsedCompact(12_000)).toBe("12s");
    expect(formatZdEstimateElapsedCompact(65_000)).toBe("1:05");
  });

  it("elapsed label — busy vs complete", () => {
    expect(
      zdEstimateLoadingElapsedLabel({
        elapsedMs: 12_000,
        busyDetail: "postęp szacunkowy",
      })
    ).toBe("12s · postęp szacunkowy");
    expect(
      zdEstimateLoadingElapsedLabel({
        elapsedMs: 12_000,
        forceComplete: true,
        busyDetail: "postęp szacunkowy",
      })
    ).toBe("12s · gotowe");
  });

  it("status tone — warning przy failure, complete, busy", () => {
    expect(
      resolveZdEstimateLoadingStatusTone({ completeFailed: true })
    ).toBe("warning");
    expect(
      resolveZdEstimateLoadingStatusTone({ forceComplete: true })
    ).toBe("complete");
    expect(resolveZdEstimateLoadingStatusTone({})).toBe("busy");
    expect(
      resolveZdEstimateLoadingStatusTone({
        forceComplete: true,
        statusTone: "warning",
      })
    ).toBe("warning");
  });

  it("bar pct — derived, clamp, forceComplete", () => {
    expect(
      resolveZdEstimateLoadingBarPct({
        activeStepIndex: 0,
        stepCount: 4,
      })
    ).toBeGreaterThanOrEqual(4);
    expect(
      resolveZdEstimateLoadingBarPct({
        activeStepIndex: 0,
        stepCount: 4,
        progressPct: 50,
      })
    ).toBe(50);
    expect(
      resolveZdEstimateLoadingBarPct({
        activeStepIndex: 0,
        stepCount: 4,
        forceComplete: true,
      })
    ).toBe(100);
  });

  it("timed bar pct — monotonic, no jump back on last step wrap", () => {
    const stepMs = 1100;
    const stepCount = 3;
    const samples = [0, 500, 1100, 2200, 3299, 3300, 4400, 10_000].map(
      (elapsedMs) =>
        resolveZdEstimateTimedLoadingBarPct({
          elapsedMs,
          stepMs,
          stepCount,
          busyCapPct: 92,
        })
    );

    for (let i = 1; i < samples.length; i++) {
      expect(samples[i]!).toBeGreaterThanOrEqual(samples[i - 1]!);
    }
    expect(samples[0]).toBe(4);
    expect(samples[samples.length - 1]).toBe(92);

    // Stary bug: modulo na ostatnim kroku dawało spadek ~92 → ~66.
    const nearEndOfLast = resolveZdEstimateTimedLoadingBarPct({
      elapsedMs: 3 * stepMs - 1,
      stepMs,
      stepCount,
      busyCapPct: 92,
    });
    const wrapPastLast = resolveZdEstimateTimedLoadingBarPct({
      elapsedMs: 3 * stepMs,
      stepMs,
      stepCount,
      busyCapPct: 92,
    });
    expect(wrapPastLast).toBeGreaterThanOrEqual(nearEndOfLast);
  });

  it("step visual — failure tylko na wskazanym kroku przy complete", () => {
    const ok = resolveZdEstimateLoadingStepVisual({
      index: 0,
      activeStepIndex: 3,
      forceComplete: true,
      stepId: "prepare",
      stepFailureId: "snapshot",
    });
    expect(ok).toEqual({
      failed: false,
      done: true,
      active: false,
      pending: false,
    });

    const fail = resolveZdEstimateLoadingStepVisual({
      index: 3,
      activeStepIndex: 3,
      forceComplete: true,
      stepId: "snapshot",
      stepFailureId: "snapshot",
    });
    expect(fail).toEqual({
      failed: true,
      done: false,
      active: false,
      pending: false,
    });

    const active = resolveZdEstimateLoadingStepVisual({
      index: 1,
      activeStepIndex: 1,
      stepId: "sfera",
    });
    expect(active.active).toBe(true);
    expect(active.done).toBe(false);
  });
});
