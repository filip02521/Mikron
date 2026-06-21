import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resolveClientLoginSubtitleMode } from "./login-client-subtitle";
import {
  LOGIN_LAST_ACCOUNT_STORAGE_KEY,
  LOGIN_RECENT_ACCOUNT_LABELS_STORAGE_KEY,
  LOGIN_RECENT_ACCOUNTS_STORAGE_KEY,
} from "./login-account-preference";

describe("resolveClientLoginSubtitleMode", () => {
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

  it("preferuje quick login gdy jest cache etykiety", () => {
    storage[LOGIN_LAST_ACCOUNT_STORAGE_KEY] = "filip-id";
    storage[LOGIN_RECENT_ACCOUNT_LABELS_STORAGE_KEY] = JSON.stringify({
      "filip-id": "Filip",
    });

    expect(
      resolveClientLoginSubtitleMode({
        preloadedAccountCount: 0,
        modeParam: null,
      })
    ).toBe("quick");
  });

  it("pokazuje picker gdy są zapisane konta bez etykiety", () => {
    storage[LOGIN_LAST_ACCOUNT_STORAGE_KEY] = "acc-1";
    storage[LOGIN_RECENT_ACCOUNTS_STORAGE_KEY] = JSON.stringify(["acc-1", "acc-2"]);

    expect(
      resolveClientLoginSubtitleMode({
        preloadedAccountCount: 0,
        modeParam: null,
      })
    ).toBe("picker");
  });
});
