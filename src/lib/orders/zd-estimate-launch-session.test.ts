import { afterEach, describe, expect, it, vi } from "vitest";
import {
  claimZdEstimateLaunchAutorun,
  isZdEstimateLaunchAutorunDone,
  isZdEstimateLaunchTimeoutFeedback,
  markZdEstimateLaunchAutorunDone,
  releaseZdEstimateLaunchAutorunPending,
  ZD_ESTIMATE_LAUNCH_AUTORUN_STORAGE_PREFIX,
} from "@/lib/orders/zd-estimate-launch-session";

describe("zd-estimate-launch-session", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("claims once, then already_done after mark", () => {
    const store = new Map<string, string>();
    vi.stubGlobal("sessionStorage", {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => {
        store.set(k, v);
      },
      removeItem: (k: string) => {
        store.delete(k);
      },
    });

    expect(claimZdEstimateLaunchAutorun("abc")).toBe("claimed");
    expect(
      store.get(`${ZD_ESTIMATE_LAUNCH_AUTORUN_STORAGE_PREFIX}abc`)
    ).toBe("pending");

    markZdEstimateLaunchAutorunDone("abc");
    expect(claimZdEstimateLaunchAutorun("abc")).toBe("already_done");
  });

  it("release pending allows re-claim (Strict Mode cleanup)", () => {
    const store = new Map<string, string>();
    vi.stubGlobal("sessionStorage", {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => {
        store.set(k, v);
      },
      removeItem: (k: string) => {
        store.delete(k);
      },
    });

    expect(claimZdEstimateLaunchAutorun("k1")).toBe("claimed");
    releaseZdEstimateLaunchAutorunPending("k1");
    expect(claimZdEstimateLaunchAutorun("k1")).toBe("claimed");
  });

  it("isZdEstimateLaunchAutorunDone after mark", () => {
    const store = new Map<string, string>();
    vi.stubGlobal("sessionStorage", {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => {
        store.set(k, v);
      },
      removeItem: (k: string) => {
        store.delete(k);
      },
    });
    expect(isZdEstimateLaunchAutorunDone("x")).toBe(false);
    markZdEstimateLaunchAutorunDone("x");
    expect(isZdEstimateLaunchAutorunDone("x")).toBe(true);
  });

  it("empty key → unavailable", () => {
    expect(claimZdEstimateLaunchAutorun("")).toBe("unavailable");
    expect(claimZdEstimateLaunchAutorun(null)).toBe("unavailable");
  });

  it("detects timeout feedback", () => {
    expect(
      isZdEstimateLaunchTimeoutFeedback({ code: "timeout" })
    ).toBe(true);
    expect(
      isZdEstimateLaunchTimeoutFeedback({
        code: "network",
        message: "Przekroczono czas oczekiwania",
      })
    ).toBe(true);
    expect(
      isZdEstimateLaunchTimeoutFeedback({
        code: "empty_query",
        message: "Wybierz grupę",
      })
    ).toBe(false);
  });
});
