import { describe, expect, it } from "vitest";
import {
  getZkWatchProsbaScopeLineKeys,
  isZkWatchProsbaScopeConfigured,
  mergeZkWatchLineChecksPreservingProsbaScope,
} from "./zk-watch-prosba-scope";
import type { ZkWatchLineView } from "./zk-watch-lines";

const lines: ZkWatchLineView[] = [
  {
    key: "ob:1",
    product: "A",
    symbol: null,
    quantityLabel: "1 szt.",
    quantity: 1,
    subiektTwId: 1,
    arrived: false,
  },
  {
    key: "ob:2",
    product: "B",
    symbol: null,
    quantityLabel: "2 szt.",
    quantity: 2,
    subiektTwId: 2,
    arrived: false,
  },
];

describe("zk-watch-prosba-scope", () => {
  it("nie jest skonfigurowany gdy brak needs_prosba", () => {
    expect(isZkWatchProsbaScopeConfigured([], lines)).toBe(false);
  });

  it("zwraca wybrane klucze po konfiguracji", () => {
    const watch = {
      line_checks: [
        { key: "ob:1", arrived: false, needs_prosba: true },
        { key: "ob:2", arrived: false, needs_prosba: false },
      ],
    };
    expect(getZkWatchProsbaScopeLineKeys(watch, lines)).toEqual(["ob:1"]);
  });

  it("zachowuje needs_prosba przy aktualizacji arrived", () => {
    const merged = mergeZkWatchLineChecksPreservingProsbaScope(
      lines,
      [{ key: "ob:1", arrived: false, needs_prosba: true }],
      { arrivedByKey: new Map([["ob:1", true]]) }
    );
    expect(merged[0]).toEqual({ key: "ob:1", arrived: true, needs_prosba: true });
  });

  it("aktualizuje needs_prosba tylko dla wskazanych pozycji", () => {
    const merged = mergeZkWatchLineChecksPreservingProsbaScope(
      lines,
      [
        { key: "ob:1", arrived: false, needs_prosba: true },
        { key: "ob:2", arrived: false, needs_prosba: false },
      ],
      { needsProsbaByKey: new Map([["ob:2", true]]) }
    );
    expect(merged[0]).toEqual({ key: "ob:1", arrived: false, needs_prosba: true });
    expect(merged[1]).toEqual({ key: "ob:2", arrived: false, needs_prosba: true });
  });
});
