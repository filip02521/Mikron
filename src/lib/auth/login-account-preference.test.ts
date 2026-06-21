import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  LOGIN_LAST_ACCOUNT_STORAGE_KEY,
  LOGIN_RECENT_ACCOUNTS_STORAGE_KEY,
  LOGIN_RECENT_ACCOUNT_LABELS_STORAGE_KEY,
  LOGIN_RECENT_EMAILS_STORAGE_KEY,
  MAX_RECENT_LOGIN_ACCOUNTS,
  canShowCachedQuickLogin,
  readLoginAccountDisplayName,
  readLoginLastAccountId,
  readLoginRecentAccountIds,
  readLoginRecentEmails,
  rememberLoginAccountId,
  rememberLoginEmail,
  resolveLoginLastAccountId,
  resolveLoginRecentAccountIds,
  resolveQuickLoginAccountId,
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

  it("pamięta wiele kont w kolejności od najnowszego", () => {
    rememberLoginAccountId("a");
    rememberLoginAccountId("b");
    rememberLoginAccountId("c");

    expect(readLoginRecentAccountIds()).toEqual(["c", "b", "a"]);
    expect(readLoginLastAccountId()).toBe("c");
  });

  it("przenosi ponownie wybrane konto na początek listy", () => {
    rememberLoginAccountId("a");
    rememberLoginAccountId("b");
    rememberLoginAccountId("a");

    expect(readLoginRecentAccountIds()).toEqual(["a", "b"]);
  });

  it("ogranicza liczbę zapisanych kont", () => {
    for (let index = 0; index < MAX_RECENT_LOGIN_ACCOUNTS + 2; index += 1) {
      rememberLoginAccountId(`user-${index}`);
    }

    expect(readLoginRecentAccountIds()).toHaveLength(MAX_RECENT_LOGIN_ACCOUNTS);
    expect(readLoginRecentAccountIds()[0]).toBe(`user-${MAX_RECENT_LOGIN_ACCOUNTS + 1}`);
  });

  it("migruje stare pojedyncze konto do listy ostatnich", () => {
    storage[LOGIN_LAST_ACCOUNT_STORAGE_KEY] = "legacy-user";
    expect(readLoginRecentAccountIds()).toEqual(["legacy-user"]);
  });

  it("filtruje zapisaną listę kont do dostępnych w katalogu", () => {
    rememberLoginAccountId("a");
    rememberLoginAccountId("b");
    rememberLoginAccountId("c");

    expect(resolveLoginRecentAccountIds([{ id: "b" }, { id: "c" }, { id: "d" }])).toEqual([
      "c",
      "b",
    ]);
  });

  it("pamięta ostatnie adresy e-mail do logowania ręcznego", () => {
    rememberLoginEmail("  Anna@Example.com ");
    rememberLoginEmail("zakupy@mikran.com");
    rememberLoginEmail("anna@example.com");

    expect(readLoginRecentEmails()).toEqual(["anna@example.com", "zakupy@mikran.com"]);
    expect(JSON.parse(storage[LOGIN_RECENT_EMAILS_STORAGE_KEY]!)).toEqual([
      "anna@example.com",
      "zakupy@mikran.com",
    ]);
  });

  it("zapisuje listę kont w localStorage jako JSON", () => {
    rememberLoginAccountId("user-1");
    expect(JSON.parse(storage[LOGIN_RECENT_ACCOUNTS_STORAGE_KEY]!)).toEqual(["user-1"]);
  });

  it("zapisuje etykiety kont do powitania quick login", () => {
    rememberLoginAccountId("user-1", "Filip");
    expect(readLoginAccountDisplayName("user-1")).toBe("Filip");
    expect(canShowCachedQuickLogin()).toBe(true);
  });

  it("resolveQuickLoginAccountId działa przed fetch katalogu", () => {
    rememberLoginAccountId("user-1", "Filip");
    expect(resolveQuickLoginAccountId([])).toBe("user-1");
  });

  it("przycina etykiety do aktualnej listy kont", () => {
    rememberLoginAccountId("a", "Anna");
    rememberLoginAccountId("b", "Bogdan");
    rememberLoginAccountId("c", "Celina");

    expect(JSON.parse(storage[LOGIN_RECENT_ACCOUNT_LABELS_STORAGE_KEY]!)).toEqual({
      a: "Anna",
      b: "Bogdan",
      c: "Celina",
    });
  });
});
