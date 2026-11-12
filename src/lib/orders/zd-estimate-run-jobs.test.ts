import { beforeEach, describe, expect, it } from "vitest";
import {
  __resetZdEstimateRunJobStoreForTests,
  beginZdEstimateRunJob,
  collectZdEstimateRunJob,
  finishZdEstimateRunJob,
  ZD_ESTIMATE_RUN_JOB_RUNNING_TTL_MS,
} from "./zd-estimate-run-jobs";

describe("zd-estimate-run-jobs", () => {
  beforeEach(() => __resetZdEstimateRunJobStoreForTests());

  it("running → done, wynik tylko dla właściciela", () => {
    expect(beginZdEstimateRunJob("r1", "u1", 0)).toBe(true);
    expect(collectZdEstimateRunJob("r1", "u1", 1)).toEqual({ state: "running" });
    expect(collectZdEstimateRunJob("r1", "u2", 1)).toEqual({ state: "missing" });

    finishZdEstimateRunJob("r1", "u2", { ok: true }, 2);
    expect(collectZdEstimateRunJob("r1", "u1", 3)).toEqual({ state: "running" });

    finishZdEstimateRunJob("r1", "u1", { ok: true }, 4);
    expect(collectZdEstimateRunJob("r1", "u1", 5)).toEqual({ state: "done", result: { ok: true } });
  });

  it("nie nadpisuje zajętego id", () => {
    expect(beginZdEstimateRunJob("r1", "u1", 0)).toBe(true);
    expect(beginZdEstimateRunJob("r1", "u2", 1)).toBe(false);
    expect(beginZdEstimateRunJob("r1", "u1", 1)).toBe(false);
  });

  it("wynik przeżywa ponowny odbiór przez minutę, potem znika", () => {
    beginZdEstimateRunJob("r1", "u1", 0);
    finishZdEstimateRunJob("r1", "u1", 7, 0);
    expect(collectZdEstimateRunJob("r1", "u1", 1_000).state).toBe("done");
    expect(collectZdEstimateRunJob("r1", "u1", 30_000).state).toBe("done");
    expect(collectZdEstimateRunJob("r1", "u1", 62_000).state).toBe("missing");
  });

  it("porzucone liczenie wygasa", () => {
    beginZdEstimateRunJob("r1", "u1", 0);
    expect(collectZdEstimateRunJob("r1", "u1", ZD_ESTIMATE_RUN_JOB_RUNNING_TTL_MS + 1)).toEqual({ state: "missing" });
  });
});
