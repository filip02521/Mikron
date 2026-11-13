import { beforeEach, describe, expect, it } from "vitest";
import {
  __resetZdEstimateRunJobStoreForTests,
  beginZdEstimateRunJob,
  collectZdEstimateRunJob,
  finishZdEstimateRunJob,
  isZdEstimateRunJobSuperseded,
  peekZdEstimateRunJobSummary,
  ZD_ESTIMATE_RUN_JOB_RUNNING_TTL_MS,
  ZD_ESTIMATE_RUN_JOB_SUMMARY_TTL_MS,
} from "./zd-estimate-run-jobs";

describe("zd-estimate-run-jobs", () => {
  beforeEach(() => __resetZdEstimateRunJobStoreForTests());

  it("running → done, wynik tylko dla właściciela", () => {
    expect(beginZdEstimateRunJob("r1", "u1", 0)).toBe(true);
    expect(collectZdEstimateRunJob("r1", "u1", 1)).toEqual({ state: "running" });
    expect(collectZdEstimateRunJob("r1", "u2", 1)).toEqual({ state: "missing" });
    expect(peekZdEstimateRunJobSummary("r1", "u2", 1)).toEqual({ state: "missing" });

    finishZdEstimateRunJob("r1", "u2", { ok: true }, "s", 2);
    expect(collectZdEstimateRunJob("r1", "u1", 3)).toEqual({ state: "running" });

    finishZdEstimateRunJob("r1", "u1", { ok: true }, "s", 4);
    expect(collectZdEstimateRunJob("r1", "u1", 5)).toEqual({ state: "done", result: { ok: true } });
  });

  it("nie nadpisuje zajętego id", () => {
    expect(beginZdEstimateRunJob("r1", "u1", 0)).toBe(true);
    expect(beginZdEstimateRunJob("r1", "u2", 1)).toBe(false);
    expect(beginZdEstimateRunJob("r1", "u1", 1)).toBe(false);
  });

  it("lista przeżywa ponowny odbiór przez minutę, potem znika z pamięci", () => {
    beginZdEstimateRunJob("r1", "u1", 0);
    finishZdEstimateRunJob("r1", "u1", 7, "s", 0);
    expect(collectZdEstimateRunJob("r1", "u1", 1_000).state).toBe("done");
    expect(collectZdEstimateRunJob("r1", "u1", 30_000).state).toBe("done");
    expect(collectZdEstimateRunJob("r1", "u1", 62_000).state).toBe("missing");
  });

  it("podsumowanie żyje dobę — także po zniknięciu listy i bez skracania jej życia", () => {
    beginZdEstimateRunJob("r1", "u1", 0);
    expect(peekZdEstimateRunJobSummary("r1", "u1", 1)).toEqual({ state: "running" });
    finishZdEstimateRunJob("r1", "u1", 7, { sessionId: "s" }, 0);
    expect(peekZdEstimateRunJobSummary("r1", "u1", 1_000)).toEqual({ state: "done", summary: { sessionId: "s" } });
    expect(collectZdEstimateRunJob("r1", "u1", 200_000).state).toBe("done");
    // Karta spała godzinę: lista wypadła z pamięci, ale wiadomo, którą sesję otworzyć.
    expect(collectZdEstimateRunJob("r1", "u1", 3_600_000).state).toBe("missing");
    expect(peekZdEstimateRunJobSummary("r1", "u1", 3_600_000).state).toBe("done");
    expect(peekZdEstimateRunJobSummary("r1", "u1", ZD_ESTIMATE_RUN_JOB_SUMMARY_TTL_MS + 1).state).toBe("missing");
  });

  it("porzucone liczenie wygasa", () => {
    beginZdEstimateRunJob("r1", "u1", 0);
    expect(collectZdEstimateRunJob("r1", "u1", ZD_ESTIMATE_RUN_JOB_RUNNING_TTL_MS + 1)).toEqual({ state: "missing" });
  });

  it("starsze liczenie jest zastąpione przez nowsze tego samego użytkownika", () => {
    // Liczenie spoza magazynu nigdy nie jest „zastąpione”.
    expect(isZdEstimateRunJobSuperseded("x", "u1", 0)).toBe(false);

    beginZdEstimateRunJob("r1", "u1", 0);
    expect(isZdEstimateRunJobSuperseded("r1", "u1", 1)).toBe(false);
    beginZdEstimateRunJob("other", "u2", 1);
    expect(isZdEstimateRunJobSuperseded("r1", "u1", 2)).toBe(false);

    beginZdEstimateRunJob("r2", "u1", 3);
    expect(isZdEstimateRunJobSuperseded("r1", "u1", 4)).toBe(true);
    expect(isZdEstimateRunJobSuperseded("r2", "u1", 4)).toBe(false);
  });
});
