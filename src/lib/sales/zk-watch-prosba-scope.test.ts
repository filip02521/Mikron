import { describe, expect, it } from "vitest";
import {
  filterZkWatchProductLineViewsForScope,
  getZkWatchProsbaScopeLineKeys,
  hasZkWatchTrackedProsbaScope,
  isZkWatchProsbaScopeConfigured,
  mergeZkWatchLineChecksPreservingProsbaScope,
  countZkWatchLinesOutsideTrackedScope,
  getZkWatchTrackedScopeLineKeys,
  deriveZkProsbaScopeAutoProsbaGate,
} from "./zk-watch-prosba-scope";
import { allZkWatchLinesCheckboxChecked } from "./zk-watch-line-ui-state";
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
    shelf_marked: false,
    completed_manually: false,
  },
  {
    key: "ob:2",
    product: "B",
    symbol: null,
    quantityLabel: "2 szt.",
    quantity: 2,
    subiektTwId: 2,
    arrived: false,
    shelf_marked: false,
    completed_manually: false,
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

  it("getZkWatchTrackedScopeLineKeys obejmuje pozycje do zamówienia i pominięte", () => {
    const watch = {
      line_checks: [
        { key: "ob:1", arrived: false, needs_prosba: true },
        { key: "ob:2", arrived: false, needs_prosba: false },
      ],
    };
    expect(getZkWatchTrackedScopeLineKeys(watch, lines)?.sort()).toEqual(["ob:1", "ob:2"]);
    expect(hasZkWatchTrackedProsbaScope(watch)).toBe(true);
  });

  it("filterZkWatchProductLineViewsForScope ukrywa nowe pozycje spoza zakresu", () => {
    const watch = {
      line_checks: [{ key: "ob:1", arrived: false, needs_prosba: true }],
    };
    const withNew: ZkWatchLineView[] = [
      ...lines,
      {
        key: "ob:3",
        product: "C",
        symbol: null,
        quantityLabel: "1 szt.",
        quantity: 1,
        subiektTwId: 3,
        arrived: false,
        shelf_marked: false,
        completed_manually: false,
      },
    ];
    expect(
      filterZkWatchProductLineViewsForScope(withNew, watch, { showAllLines: false }).map(
        (line) => line.key
      )
    ).toEqual(["ob:1"]);
    expect(countZkWatchLinesOutsideTrackedScope(watch, withNew)).toBe(2);
    expect(
      filterZkWatchProductLineViewsForScope(withNew, watch, { showAllLines: true }).map(
        (line) => line.key
      )
    ).toEqual(["ob:1", "ob:2", "ob:3"]);
  });

  it("pozycje spoza zakresu nie blokują gotowości do zamknięcia na widoku scoped", () => {
    const watch = {
      line_checks: [{ key: "ob:1", arrived: true, needs_prosba: true }],
    };
    const withOrphans: ZkWatchLineView[] = [
      { ...lines[0], arrived: true },
      lines[1],
      {
        key: "ob:3",
        product: "C",
        symbol: null,
        quantityLabel: "1 szt.",
        quantity: 1,
        subiektTwId: 3,
        arrived: false,
        shelf_marked: false,
        completed_manually: false,
      },
    ];
    const scoped = filterZkWatchProductLineViewsForScope(withOrphans, watch, {
      showAllLines: false,
    });
    expect(
      allZkWatchLinesCheckboxChecked({
        lineViews: scoped,
        newLineKeys: ["ob:2", "ob:3"],
        inStockLineKeys: [],
        scopeExcludedLineKeys: [],
        lineCoverageByKey: { "ob:1": "delivered" },
      })
    ).toBe(true);
    expect(
      allZkWatchLinesCheckboxChecked({
        lineViews: withOrphans,
        newLineKeys: ["ob:2", "ob:3"],
        inStockLineKeys: [],
        scopeExcludedLineKeys: [],
        lineCoverageByKey: { "ob:1": "delivered" },
      })
    ).toBe(false);
  });
});

describe("deriveZkProsbaScopeAutoProsbaGate", () => {
  const ready = {
    stockUnavailable: false,
    teethCatalogUnavailable: false,
    overBatchLimit: false,
    stockLoading: false,
    teethIncomplete: false,
  };

  it("włączone gdy wszystko gotowe", () => {
    expect(deriveZkProsbaScopeAutoProsbaGate(ready)).toEqual({
      disabled: false,
      hint: null,
    });
  });

  it("blokuje podczas ładowania magazynu", () => {
    const gate = deriveZkProsbaScopeAutoProsbaGate({ ...ready, stockLoading: true });
    expect(gate.disabled).toBe(true);
    expect(gate.hint).toContain("Sprawdzam stan");
  });

  it("blokuje przy >30 pozycjach", () => {
    const gate = deriveZkProsbaScopeAutoProsbaGate({ ...ready, overBatchLimit: true });
    expect(gate.disabled).toBe(true);
    expect(gate.hint).toContain("30 pozycji");
  });

  it("blokuje gdy katalog zębów niedostępny", () => {
    const gate = deriveZkProsbaScopeAutoProsbaGate({
      ...ready,
      teethCatalogUnavailable: true,
    });
    expect(gate.disabled).toBe(true);
    expect(gate.hint).toContain("Katalog zębów");
  });

  it("blokuje gdy fetch stanu się nie udał", () => {
    const gate = deriveZkProsbaScopeAutoProsbaGate({
      ...ready,
      stockUnavailable: true,
    });
    expect(gate.disabled).toBe(true);
    expect(gate.hint).toContain("Nie udało się sprawdzić");
  });

  it("nie blokuje przy niekompletnych zębach — tylko hint", () => {
    const gate = deriveZkProsbaScopeAutoProsbaGate({
      ...ready,
      teethIncomplete: true,
    });
    expect(gate.disabled).toBe(false);
    expect(gate.hint).toContain("listę zębów");
  });

  it("priorytet hintów: batch > katalog > stock fail > loading > zęby", () => {
    expect(
      deriveZkProsbaScopeAutoProsbaGate({
        ...ready,
        overBatchLimit: true,
        stockLoading: true,
        teethIncomplete: true,
      }).hint
    ).toContain("30 pozycji");

    expect(
      deriveZkProsbaScopeAutoProsbaGate({
        ...ready,
        teethCatalogUnavailable: true,
        stockLoading: true,
      }).hint
    ).toContain("Katalog zębów");

    expect(
      deriveZkProsbaScopeAutoProsbaGate({
        ...ready,
        stockUnavailable: true,
        stockLoading: true,
      }).hint
    ).toContain("Nie udało się");
  });
});
