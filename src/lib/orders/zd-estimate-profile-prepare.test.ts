import { describe, expect, it, vi } from "vitest";
import { waitForZdSalesProfile } from "./zd-estimate-profile-prepare";
import type { ZdSalesProfilePrepareStatus } from "@/lib/orders/zd-sales-profile-load";

function scripted(statuses: ZdSalesProfilePrepareStatus["status"][]) {
  const calls = { n: 0 };
  const prepare = vi.fn(async (): Promise<ZdSalesProfilePrepareStatus> => {
    const status = statuses[Math.min(calls.n, statuses.length - 1)]!;
    calls.n += 1;
    return status === "failed" ? { status, message: "Subiekt timeout" } : { status };
  });
  return { prepare, calls };
}

const noSleep = async () => {};

describe("waitForZdSalesProfile", () => {
  it("profil gotowy od razu — jedno pytanie, bez ekranu „liczę profil”", async () => {
    const { prepare } = scripted(["ready"]);
    const onComputing = vi.fn();
    await expect(
      waitForZdSalesProfile({ prepare, isCancelled: () => false, onComputing, sleep: noSleep })
    ).resolves.toBe("continue");
    expect(prepare).toHaveBeenCalledTimes(1);
    expect(onComputing).not.toHaveBeenCalled();
  });

  it("pyta, dopóki profil się liczy, potem przechodzi do listy", async () => {
    const { prepare } = scripted(["computing", "computing", "ready"]);
    const onComputing = vi.fn();
    await expect(
      waitForZdSalesProfile({ prepare, isCancelled: () => false, onComputing, sleep: noSleep })
    ).resolves.toBe("continue");
    expect(prepare).toHaveBeenCalledTimes(3);
    expect(onComputing).toHaveBeenCalledTimes(2);
  });

  it("błąd liczenia profilu nie blokuje — lista liczy się z bezpiecznikiem silnika", async () => {
    const { prepare } = scripted(["computing", "failed"]);
    await expect(waitForZdSalesProfile({ prepare, isCancelled: () => false, sleep: noSleep })).resolves.toBe(
      "continue"
    );
    expect(prepare).toHaveBeenCalledTimes(2);
  });

  it("nowe liczenie w trakcie czekania przerywa pętlę", async () => {
    const { prepare, calls } = scripted(["computing"]);
    await expect(
      waitForZdSalesProfile({ prepare, isCancelled: () => calls.n >= 2, sleep: noSleep })
    ).resolves.toBe("cancelled");
  });

  it("po maksymalnym czasie przechodzi do listy mimo liczenia", async () => {
    const { prepare } = scripted(["computing"]);
    let t = 0;
    await expect(
      waitForZdSalesProfile({
        prepare,
        isCancelled: () => false,
        sleep: async (ms) => {
          t += ms;
        },
        now: () => t,
        pollMs: 3_000,
        maxWaitMs: 9_000,
      })
    ).resolves.toBe("continue");
    expect(prepare).toHaveBeenCalledTimes(4);
  });

  it("błąd sieci przy pytaniu — przechodzi do listy (krok 2 zgłosi błąd)", async () => {
    const prepare = vi.fn(async (): Promise<ZdSalesProfilePrepareStatus> => {
      throw new Error("network");
    });
    await expect(waitForZdSalesProfile({ prepare, isCancelled: () => false, sleep: noSleep })).resolves.toBe(
      "continue"
    );
  });
});
