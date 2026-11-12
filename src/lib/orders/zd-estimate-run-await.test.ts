import { describe, expect, it } from "vitest";
import { awaitZdEstimateRunJob } from "./zd-estimate-run-await";
import type { ZdEstimateRunJobState } from "./zd-estimate-run-jobs";

const noSleep = async () => {};

function collectFrom(steps: Array<ZdEstimateRunJobState<number> | "throw">) {
  let i = 0;
  return async () => {
    const step = steps[Math.min(i, steps.length - 1)];
    i += 1;
    if (step === "throw") throw new Error("An unexpected response was received from the server.");
    return step;
  };
}

describe("awaitZdEstimateRunJob", () => {
  it("czeka na wynik i przeżywa pojedyncze zerwane odbiory", async () => {
    const out = await awaitZdEstimateRunJob<number>({
      start: async () => ({ ok: true, runId: "r" }),
      collect: collectFrom([{ state: "running" }, "throw", { state: "running" }, { state: "done", result: 42 }]),
      sleep: noSleep,
    });
    expect(out).toEqual({ ok: true, result: 42 });
  });

  it("zadanie zniknęło z serwera → komunikat o przerwaniu", async () => {
    const out = await awaitZdEstimateRunJob<number>({
      start: async () => ({ ok: true, runId: "r" }),
      collect: collectFrom([{ state: "running" }, { state: "missing" }]),
      sleep: noSleep,
    });
    expect(out.ok).toBe(false);
    if (!out.ok) expect(out.failure.title).toBe("Liczenie zostało przerwane");
  });

  it("start bez połączenia i seria zerwanych odbiorów → brak połączenia", async () => {
    const startFailed = await awaitZdEstimateRunJob<number>({
      start: async () => {
        throw new Error("Failed to fetch");
      },
      collect: collectFrom([{ state: "running" }]),
      sleep: noSleep,
    });
    expect(startFailed.ok === false && startFailed.failure.code).toBe("network");

    const collectFailed = await awaitZdEstimateRunJob<number>({
      start: async () => ({ ok: true, runId: "r" }),
      collect: collectFrom(["throw"]),
      sleep: noSleep,
    });
    expect(collectFailed.ok === false && collectFailed.failure.code).toBe("network");
  });

  it("odmowa startu i limit czasu", async () => {
    const refused = await awaitZdEstimateRunJob<number>({
      start: async () => ({ ok: false, message: "To liczenie już trwa." }),
      collect: collectFrom([{ state: "running" }]),
      sleep: noSleep,
    });
    expect(refused.ok === false && refused.failure.message).toBe("To liczenie już trwa.");

    let t = 0;
    const timedOut = await awaitZdEstimateRunJob<number>({
      start: async () => ({ ok: true, runId: "r" }),
      collect: collectFrom([{ state: "running" }]),
      sleep: noSleep,
      now: () => (t += 60_000),
    });
    expect(timedOut.ok === false && timedOut.failure.code).toBe("timeout");
  });
});
