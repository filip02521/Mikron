import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  __resetProsbaSuccessFlashForTests,
  buildZkProsbaSuccessFlash,
  clearProsbaSuccessFlash,
  consumeProsbaSuccessFlash,
  peekProsbaSuccessFlash,
  PROSBA_SUCCESS_FLASH_STORAGE_KEY,
  prosbaSuccessFlashToAutoToast,
  stashProsbaSuccessFlash,
} from "@/lib/orders/prosba-success-flash";

describe("prosba-success-flash", () => {
  beforeEach(() => {
    __resetProsbaSuccessFlashForTests();
    const store = new Map<string, string>();
    vi.stubGlobal("sessionStorage", {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => {
        store.set(k, v);
      },
      removeItem: (k: string) => {
        store.delete(k);
      },
      clear: () => store.clear(),
    });
    vi.stubGlobal("window", { sessionStorage: globalThis.sessionStorage });
  });

  afterEach(() => {
    __resetProsbaSuccessFlashForTests();
    vi.unstubAllGlobals();
  });

  it("buildZkProsbaSuccessFlash zawiera numer ZK i liczbę pozycji", () => {
    const flash = buildZkProsbaSuccessFlash({
      zkNumber: "ZK 153157/M/04/2026",
      zkWatchId: "w1",
      count: 3,
      complete: 3,
      verification: 0,
      requestKind: "zamowienie",
      actionHref: "/moje?klient=Acme",
    });
    expect(flash.title).toBe("Prośba zapisana");
    expect(flash.message).toMatch(/153157/);
    expect(flash.message).toMatch(/3 pozycj/);
    expect(flash.message).not.toMatch(/Prośba zapisana\. Prośba zapisana/);
    expect(flash.tone).toBe("success");
    expect(flash.actionHref).toBe("/moje?klient=Acme");
  });

  it("stash → peek → consume (jednorazowo po microtask)", async () => {
    const flash = buildZkProsbaSuccessFlash({
      zkNumber: "100",
      count: 1,
      complete: 1,
      verification: 0,
      requestKind: "zamowienie",
    });
    expect(stashProsbaSuccessFlash(flash)).toBe(true);
    expect(peekProsbaSuccessFlash()?.title).toBe("Prośba zapisana");
    expect(consumeProsbaSuccessFlash()?.message).toMatch(/ZK/);
    await Promise.resolve();
    expect(consumeProsbaSuccessFlash()).toBeNull();
    expect(sessionStorage.getItem(PROSBA_SUCCESS_FLASH_STORAGE_KEY)).toBeNull();
  });

  it("Strict Mode: drugi synchroniczny consume nadal oddaje flash", () => {
    stashProsbaSuccessFlash(
      buildZkProsbaSuccessFlash({
        zkNumber: "100",
        count: 1,
        complete: 1,
        verification: 0,
        requestKind: "zamowienie",
      })
    );
    const first = consumeProsbaSuccessFlash();
    const second = consumeProsbaSuccessFlash();
    expect(first?.title).toBe("Prośba zapisana");
    expect(second?.title).toBe("Prośba zapisana");
    expect(consumeProsbaSuccessFlash()).toBeNull();
  });

  it("odrzuca przeterminowany flash", () => {
    stashProsbaSuccessFlash({
      title: "Prośba zapisana",
      message: "stary",
      tone: "success",
      createdAt: Date.now() - 16 * 60_000,
    });
    expect(consumeProsbaSuccessFlash()).toBeNull();
  });

  it("clearProsbaSuccessFlash czyści storage i pamięć", () => {
    stashProsbaSuccessFlash(
      buildZkProsbaSuccessFlash({
        zkNumber: "1",
        count: 1,
        complete: 1,
        verification: 0,
        requestKind: "informacja",
        mode: "supplement",
      })
    );
    clearProsbaSuccessFlash();
    expect(peekProsbaSuccessFlash()).toBeNull();
  });

  it("prosbaSuccessFlashToAutoToast mapuje pola", () => {
    const toast = prosbaSuccessFlashToAutoToast({
      title: "Prośba zapisana",
      message: "ok",
      tone: "success",
      actionHref: "/moje",
      actionLabel: "Prośby",
      createdAt: Date.now(),
    });
    expect(toast).toMatchObject({
      code: "created",
      title: "Prośba zapisana",
      message: "ok",
      tone: "success",
      actionHref: "/moje",
      actionLabel: "Prośby",
    });
  });
});
