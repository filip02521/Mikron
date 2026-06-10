import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  LOGIN_LAST_ACCOUNT_STORAGE_KEY,
  readLoginLastAccountId,
  resolveLoginLastAccountId,
  writeLoginLastAccountId,
} from "./login-account-preference";

describe("login-account-preference", () => {
  let storage: Record<string, string>;

  beforeEach(() => {
    storage = {};
    vi.stubGlobal("localStorage", {
      getItem: (key: string) => storage[key] ?? null,
      setItem: (key: string, value: string) => {
        storage[key] = value;
      },
      removeItem: (key: string) => {
        delete storage[key];
      },
    });
    vi.stubGlobal("window", { localStorage: globalThis.localStorage });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("zapisuje i odczytuje ostatnie konto", () => {
    writeLoginLastAccountId("user-1");
    expect(readLoginLastAccountId()).toBe("user-1");
    expect(storage[LOGIN_LAST_ACCOUNT_STORAGE_KEY]).toBe("user-1");
  });

  it("zwraca null gdy zapisane konto nie jest na liście", () => {
    writeLoginLastAccountId("removed");
    expect(resolveLoginLastAccountId([{ id: "other" }])).toBeNull();
  });

  it("dopasowuje zapisane konto do listy", () => {
    writeLoginLastAccountId("b");
    expect(resolveLoginLastAccountId([{ id: "a" }, { id: "b" }])).toBe("b");
  });
});
