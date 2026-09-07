import { afterEach, describe, expect, it } from "vitest";
import {
  __resetZdEstimateRunProgressStoreForTests,
  completeZdEstimateRunProgress,
  failZdEstimateRunProgress,
  getZdEstimateRunProgressForOwner,
  isValidZdEstimateRunProgressId,
  launchProgressPctFromRun,
  launchProgressStepFromRunPhase,
  registerZdEstimateRunProgress,
  shouldClearRunProgressOnMiss,
  updateZdEstimateRunProgress,
} from "@/lib/orders/zd-estimate-run-progress";

const ID = "550e8400-e29b-41d4-a716-446655440000";

afterEach(() => {
  __resetZdEstimateRunProgressStoreForTests();
});

describe("isValidZdEstimateRunProgressId", () => {
  it("accepts uuid v4", () => {
    expect(isValidZdEstimateRunProgressId(ID)).toBe(true);
  });

  it("rejects garbage", () => {
    expect(isValidZdEstimateRunProgressId("")).toBe(false);
    expect(isValidZdEstimateRunProgressId("not-a-uuid")).toBe(false);
    expect(isValidZdEstimateRunProgressId(null)).toBe(false);
  });
});

describe("zd-estimate-run-progress store", () => {
  it("registers and returns for owner", () => {
    const reg = registerZdEstimateRunProgress({
      progressId: ID,
      ownerUserId: "user-a",
    });
    expect(reg.ok).toBe(true);
    const ok = getZdEstimateRunProgressForOwner(ID, "user-a");
    expect(ok.found).toBe(true);
    if (ok.found) {
      expect(ok.snapshot.phase).toBe("starting");
    }
  });

  it("hides from other owners", () => {
    registerZdEstimateRunProgress({
      progressId: ID,
      ownerUserId: "user-a",
    });
    expect(getZdEstimateRunProgressForOwner(ID, "user-b").found).toBe(false);
  });

  it("refuses register steal by another owner", () => {
    expect(
      registerZdEstimateRunProgress({
        progressId: ID,
        ownerUserId: "user-a",
      }).ok
    ).toBe(true);
    const steal = registerZdEstimateRunProgress({
      progressId: ID,
      ownerUserId: "user-b",
    });
    expect(steal.ok).toBe(false);
    if (!steal.ok) expect(steal.reason).toBe("owned_by_other");
    expect(getZdEstimateRunProgressForOwner(ID, "user-a").found).toBe(true);
    expect(getZdEstimateRunProgressForOwner(ID, "user-b").found).toBe(false);
  });

  it("allows same owner to re-register", () => {
    registerZdEstimateRunProgress({ progressId: ID, ownerUserId: "u" });
    updateZdEstimateRunProgress(ID, "u", { phase: "fetch", pagesCommitted: 2 });
    const again = registerZdEstimateRunProgress({
      progressId: ID,
      ownerUserId: "u",
    });
    expect(again.ok).toBe(true);
    if (again.ok) expect(again.snapshot.phase).toBe("starting");
  });

  it("updates only for owner", () => {
    registerZdEstimateRunProgress({ progressId: ID, ownerUserId: "u" });
    expect(
      updateZdEstimateRunProgress(ID, "other", { phase: "fetch" })
    ).toBeNull();
    updateZdEstimateRunProgress(ID, "u", {
      phase: "fetch",
      pagesCommitted: 3,
      totalPages: 10,
      linesSoFar: 600,
      totalCountApi: 2000,
    });
    const poll = getZdEstimateRunProgressForOwner(ID, "u");
    expect(poll.found).toBe(true);
    if (poll.found) {
      expect(poll.snapshot.pagesCommitted).toBe(3);
      expect(poll.snapshot.phase).toBe("fetch");
    }
  });

  it("complete and fail set terminal phases", () => {
    registerZdEstimateRunProgress({ progressId: ID, ownerUserId: "u" });
    completeZdEstimateRunProgress(ID, "u");
    let poll = getZdEstimateRunProgressForOwner(ID, "u");
    expect(poll.found && poll.snapshot.phase).toBe("done");

    failZdEstimateRunProgress(ID, "u", "boom");
    poll = getZdEstimateRunProgressForOwner(ID, "u");
    expect(poll.found && poll.snapshot.phase).toBe("error");
    expect(poll.found && poll.snapshot.message).toBe("boom");
  });
});

describe("shouldClearRunProgressOnMiss", () => {
  it("clears only before first live hit", () => {
    expect(
      shouldClearRunProgressOnMiss({
        consecutiveMisses: 3,
        hadLiveSnapshot: false,
        missFallback: 3,
      })
    ).toBe(true);
    expect(
      shouldClearRunProgressOnMiss({
        consecutiveMisses: 10,
        hadLiveSnapshot: true,
        missFallback: 3,
      })
    ).toBe(false);
    expect(
      shouldClearRunProgressOnMiss({
        consecutiveMisses: 2,
        hadLiveSnapshot: false,
        missFallback: 3,
      })
    ).toBe(false);
  });
});

describe("launchProgressStepFromRunPhase", () => {
  it("maps phases to checklist steps", () => {
    expect(
      launchProgressStepFromRunPhase("starting", { scopeAlreadyResolved: true })
    ).toBe(1);
    expect(launchProgressStepFromRunPhase("fetch")).toBe(1);
    expect(launchProgressStepFromRunPhase("settings")).toBe(2);
    expect(launchProgressStepFromRunPhase("enrich")).toBe(2);
    expect(launchProgressStepFromRunPhase("compose")).toBe(3);
    expect(launchProgressStepFromRunPhase("done")).toBe(3);
  });
});

describe("launchProgressPctFromRun", () => {
  it("scales fetch by pages", () => {
    expect(
      launchProgressPctFromRun({
        phase: "fetch",
        pagesCommitted: 5,
        totalPages: 10,
      })
    ).toBe(36);
    expect(
      launchProgressPctFromRun({
        phase: "done",
        pagesCommitted: 10,
        totalPages: 10,
      })
    ).toBe(100);
    expect(
      launchProgressPctFromRun({
        phase: "compose",
        pagesCommitted: 10,
        totalPages: 10,
      })
    ).toBe(94);
  });
});
