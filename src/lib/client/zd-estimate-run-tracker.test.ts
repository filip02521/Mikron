import { beforeEach, describe, expect, it } from "vitest";
import {
  __resetZdEstimateRunTrackerForTests,
  dismissZdEstimateTrackedRun,
  getZdEstimateRunTrackerSnapshot,
  parseZdEstimateTrackedRun,
  releaseZdEstimateRunOwnership,
  resolveZdEstimateTrackedRun,
  settleZdEstimateRunInWizard,
  trackZdEstimateRunStarted,
} from "./zd-estimate-run-tracker";

const base = {
  runId: "r1",
  ownerUserId: "u1",
  label: "Ivoclar",
  supplierId: "s1",
  scopeMode: "cecha" as const,
  grupaId: null,
  cechaId: 2738,
  startedAtMs: 1,
};

describe("zd-estimate-run-tracker", () => {
  beforeEach(() => __resetZdEstimateRunTrackerForTests());

  it("Kreator na ekranie: wpis znika po odebraniu wyniku", () => {
    trackZdEstimateRunStarted(base);
    expect(getZdEstimateRunTrackerSnapshot()).toMatchObject({ ownedRunId: "r1", run: { state: "running" } });
    settleZdEstimateRunInWizard("r1");
    expect(getZdEstimateRunTrackerSnapshot()).toEqual({ run: null, ownedRunId: null });
  });

  it("wyjście z Kreatora: wpis zostaje, gotowa lista czeka na otwarcie", () => {
    trackZdEstimateRunStarted(base);
    releaseZdEstimateRunOwnership();
    expect(getZdEstimateRunTrackerSnapshot().ownedRunId).toBeNull();
    resolveZdEstimateTrackedRun("r1", { state: "ready", sessionId: "sess" });
    expect(getZdEstimateRunTrackerSnapshot().run).toMatchObject({ state: "ready", sessionId: "sess" });
    dismissZdEstimateTrackedRun("r1");
    expect(getZdEstimateRunTrackerSnapshot().run).toBeNull();
  });

  it("spóźniony wynik starego liczenia nie rusza nowego", () => {
    trackZdEstimateRunStarted(base);
    trackZdEstimateRunStarted({ ...base, runId: "r2" });
    settleZdEstimateRunInWizard("r1");
    resolveZdEstimateTrackedRun("r1", { state: "failed", message: "x" });
    expect(getZdEstimateRunTrackerSnapshot()).toMatchObject({ ownedRunId: "r2", run: { runId: "r2", state: "running" } });
  });

  it("odrzuca uszkodzony zapis i gotową listę bez sesji", () => {
    expect(parseZdEstimateTrackedRun("{")).toBeNull();
    expect(parseZdEstimateTrackedRun(JSON.stringify({ ...base, ownerUserId: "", state: "running" }))).toBeNull();
    expect(parseZdEstimateTrackedRun(JSON.stringify({ ...base, state: "ready", sessionId: null }))).toBeNull();
    expect(parseZdEstimateTrackedRun(JSON.stringify({ ...base, state: "failed", message: "m" }))).toMatchObject({
      state: "failed",
      message: "m",
      cechaId: 2738,
    });
  });
});
