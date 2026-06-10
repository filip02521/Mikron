import { describe, expect, it, beforeEach, vi } from "vitest";
import { createPersistedFlagStore } from "@/lib/client/persisted-flag-store";

describe("createPersistedFlagStore", () => {
  const key = "test-flag";
  let storage: Record<string, string>;

  beforeEach(() => {
    storage = {};
    vi.stubGlobal("localStorage", {
      getItem: (k: string) => storage[k] ?? null,
      setItem: (k: string, v: string) => {
        storage[k] = v;
      },
      removeItem: (k: string) => {
        delete storage[k];
      },
      clear: () => {
        storage = {};
      },
    });
    vi.stubGlobal("window", {
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    });
  });

  it("returns false from server snapshot", () => {
    const store = createPersistedFlagStore(key);
    expect(store.getServerSnapshot()).toBe(false);
  });

  it("reads persisted value from localStorage", () => {
    storage[key] = "1";
    const store = createPersistedFlagStore(key);
    expect(store.getSnapshot()).toBe(true);
  });

  it("notifies subscribers when value changes", () => {
    const store = createPersistedFlagStore(key);
    const listener = vi.fn();
    store.subscribe(listener);

    store.setValue(true);
    expect(storage[key]).toBe("1");
    expect(listener).toHaveBeenCalledTimes(1);
    expect(store.getSnapshot()).toBe(true);
  });
});
