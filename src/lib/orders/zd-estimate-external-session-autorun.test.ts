import { describe, expect, it } from "vitest";
import {
  decideZdEstimateAutorunVsExternalSession,
  isDailyPrepareZdAutorunLaunch,
} from "@/lib/orders/zd-estimate-external-session-autorun";
import { zdEstimateExternalSessionReplacedByDailyLaunchToast } from "@/lib/orders/zd-estimate-ui-copy";

describe("isDailyPrepareZdAutorunLaunch", () => {
  const base = {
    fromDaily: true,
    autorun: true,
    needsAssign: false,
    supplierId: "sup-1",
    hasRunnableScope: true,
    hasLaunchKey: true,
    bootstrapConfigured: true,
  };

  it("true dla Przygotuj ZD z podsumowania", () => {
    expect(isDailyPrepareZdAutorunLaunch(base)).toBe(true);
  });

  it("false bez fromDaily / supplier / autorun", () => {
    expect(isDailyPrepareZdAutorunLaunch({ ...base, fromDaily: false })).toBe(
      false
    );
    expect(isDailyPrepareZdAutorunLaunch({ ...base, supplierId: null })).toBe(
      false
    );
    expect(isDailyPrepareZdAutorunLaunch({ ...base, autorun: false })).toBe(
      false
    );
  });

  it("false przy needsAssign / brak bootstrapu / brak zakresu", () => {
    expect(isDailyPrepareZdAutorunLaunch({ ...base, needsAssign: true })).toBe(
      false
    );
    expect(
      isDailyPrepareZdAutorunLaunch({ ...base, bootstrapConfigured: false })
    ).toBe(false);
    expect(
      isDailyPrepareZdAutorunLaunch({ ...base, hasRunnableScope: false })
    ).toBe(false);
    expect(isDailyPrepareZdAutorunLaunch({ ...base, hasLaunchKey: false })).toBe(
      false
    );
  });
});

describe("decideZdEstimateAutorunVsExternalSession", () => {
  const runnable = {
    autorun: true,
    needsAssign: false,
    hasRunnableScope: true,
    hasLaunchKey: true,
    bootstrapConfigured: true,
  };

  it("bez tokena → none", () => {
    expect(
      decideZdEstimateAutorunVsExternalSession({
        hasActiveToken: false,
        tokenSupplierId: null,
        fromDaily: true,
        supplierId: "a",
        ...runnable,
      })
    ).toEqual({ action: "none" });
  });

  it("token + wejście bez autorun → restore", () => {
    expect(
      decideZdEstimateAutorunVsExternalSession({
        hasActiveToken: true,
        tokenSupplierId: "old",
        fromDaily: false,
        supplierId: null,
        autorun: false,
        needsAssign: false,
        hasRunnableScope: false,
        hasLaunchKey: false,
        bootstrapConfigured: true,
      })
    ).toEqual({ action: "restore" });
  });

  it("token + daily + needsAssign → restore (bez autorun)", () => {
    expect(
      decideZdEstimateAutorunVsExternalSession({
        hasActiveToken: true,
        tokenSupplierId: "old",
        fromDaily: true,
        supplierId: "new",
        autorun: true,
        needsAssign: true,
        hasRunnableScope: false,
        hasLaunchKey: false,
        bootstrapConfigured: true,
      })
    ).toEqual({ action: "restore" });
  });

  it("token + Przygotuj ZD z daily (inny dostawca) → replace_and_autorun", () => {
    expect(
      decideZdEstimateAutorunVsExternalSession({
        hasActiveToken: true,
        tokenSupplierId: "old-sup",
        fromDaily: true,
        supplierId: "new-sup",
        ...runnable,
      })
    ).toEqual({
      action: "replace_and_autorun",
      reason: "daily_prepare_zd",
      previousSupplierId: "old-sup",
      nextSupplierId: "new-sup",
      supplierChanged: true,
    });
  });

  it("token + Przygotuj ZD z daily (ten sam dostawca) → też replace (świeże Policz)", () => {
    expect(
      decideZdEstimateAutorunVsExternalSession({
        hasActiveToken: true,
        tokenSupplierId: "same",
        fromDaily: true,
        supplierId: "same",
        ...runnable,
      })
    ).toMatchObject({
      action: "replace_and_autorun",
      supplierChanged: false,
    });
  });

  it("token + autorun bez daily → conflict_dialog", () => {
    expect(
      decideZdEstimateAutorunVsExternalSession({
        hasActiveToken: true,
        tokenSupplierId: "old",
        fromDaily: false,
        supplierId: "x",
        ...runnable,
      })
    ).toEqual({ action: "conflict_dialog" });
  });
});

describe("zdEstimateExternalSessionReplacedByDailyLaunchToast", () => {
  it("opisuje zmianę dostawcy", () => {
    expect(
      zdEstimateExternalSessionReplacedByDailyLaunchToast({
        supplierChanged: true,
        nextSupplierName: "Ivoclar",
      })
    ).toEqual({
      title: "Zamknięto poprzednią sesję",
      description: "Liczymy listę ZD dla Ivoclar.",
    });
  });

  it("ten sam dostawca — ogólny opis", () => {
    expect(
      zdEstimateExternalSessionReplacedByDailyLaunchToast({
        supplierChanged: false,
        nextSupplierName: "Ivoclar",
      })
    ).toEqual({
      title: "Zamknięto poprzednią sesję",
      description: "Liczymy listę ZD od nowa.",
    });
  });
});
