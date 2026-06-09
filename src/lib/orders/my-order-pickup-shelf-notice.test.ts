import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  markPickupShelfNoticeSeen,
  resetPickupShelfNoticeForTests,
  shouldShowPickupShelfNotice,
} from "./my-order-pickup-shelf-notice";

describe("my-order-pickup-shelf-notice", () => {
  beforeEach(() => {
    const store = new Map<string, string>();
    vi.stubGlobal("sessionStorage", {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => {
        store.set(key, value);
      },
      removeItem: (key: string) => {
        store.delete(key);
      },
    });
  });

  afterEach(() => {
    resetPickupShelfNoticeForTests();
    vi.unstubAllGlobals();
  });

  it("pokazuje komunikat przy pierwszym odbiorze w sesji", () => {
    expect(shouldShowPickupShelfNotice()).toBe(true);
    markPickupShelfNoticeSeen();
    expect(shouldShowPickupShelfNotice()).toBe(false);
  });

  it("gdy sessionStorage rzuca wyjątek — traktuj jak brak flagi (pokazuj komunikat)", () => {
    vi.stubGlobal("sessionStorage", {
      getItem: () => {
        throw new Error("blocked");
      },
      setItem: () => {
        throw new Error("blocked");
      },
      removeItem: () => {
        throw new Error("blocked");
      },
    });
    expect(shouldShowPickupShelfNotice()).toBe(true);
    markPickupShelfNoticeSeen();
    expect(shouldShowPickupShelfNotice()).toBe(true);
  });
});
