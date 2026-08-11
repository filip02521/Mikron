import { describe, expect, it } from "vitest";
import {
  createZdProgressDurationHint,
  createZdProgressPercent,
  createZdProgressStepFromElapsed,
  createZdProgressStepMs,
  formatZdCreateElapsedLabel,
  ZD_CREATE_PROGRESS_LARGE_LINES,
  ZD_CREATE_PROGRESS_TIMEOUT_MS,
} from "@/lib/orders/zd-estimate-create-progress";

describe("createZdProgressStepMs", () => {
  it("scales with line count", () => {
    expect(createZdProgressStepMs(10)).toBeLessThan(createZdProgressStepMs(100));
    expect(createZdProgressStepMs(100)).toBeLessThan(
      createZdProgressStepMs(ZD_CREATE_PROGRESS_LARGE_LINES + 1)
    );
  });
});

describe("createZdProgressStepFromElapsed", () => {
  it("starts at prepare", () => {
    expect(createZdProgressStepFromElapsed(0, { lineCount: 20 })).toBe(0);
  });

  it("parks on Sfera for two ticks", () => {
    const stepMs = createZdProgressStepMs(20);
    expect(createZdProgressStepFromElapsed(stepMs, { lineCount: 20 })).toBe(1);
    expect(createZdProgressStepFromElapsed(stepMs * 2, { lineCount: 20 })).toBe(
      1
    );
    expect(createZdProgressStepFromElapsed(stepMs * 3, { lineCount: 20 })).toBe(
      2
    );
    expect(createZdProgressStepFromElapsed(stepMs * 4, { lineCount: 20 })).toBe(
      3
    );
  });

  it("forceComplete jumps to last", () => {
    expect(
      createZdProgressStepFromElapsed(0, { forceComplete: true })
    ).toBe(3);
  });
});

describe("createZdProgressPercent", () => {
  it("moves continuously and caps before complete", () => {
    const a = createZdProgressPercent(0);
    const b = createZdProgressPercent(30_000);
    const c = createZdProgressPercent(ZD_CREATE_PROGRESS_TIMEOUT_MS);
    expect(a).toBeGreaterThanOrEqual(6);
    expect(b).toBeGreaterThan(a);
    expect(c).toBe(94);
    expect(createZdProgressPercent(1_000, { forceComplete: true })).toBe(100);
  });

  it("never decreases over time", () => {
    let prev = -1;
    for (let t = 0; t <= 180_000; t += 5_000) {
      const p = createZdProgressPercent(t);
      expect(p).toBeGreaterThanOrEqual(prev);
      prev = p;
    }
  });
});

describe("hints / labels", () => {
  it("mentions longer wait for large lists", () => {
    expect(createZdProgressDurationHint(250)).toMatch(/1–3/);
    expect(createZdProgressDurationHint(10)).toMatch(/poniżej minuty/);
  });

  it("formats elapsed", () => {
    expect(formatZdCreateElapsedLabel(12_000)).toBe("Minęło 12 s");
    expect(formatZdCreateElapsedLabel(65_000)).toBe("Minęło 1:05");
  });
});
