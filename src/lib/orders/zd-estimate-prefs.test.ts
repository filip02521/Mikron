import { describe, expect, it } from "vitest";
import {
  isZdEstimateFavorite,
  mergeZdEstimateUiPrefsIntoPreferences,
  moveZdEstimateColumnOrder,
  parseZdEstimateColumnOrder,
  parseZdEstimateColumnVisibility,
  parseZdEstimateFavoriteRefs,
  parseZdEstimateUiPrefs,
  resolveZdEstimateColumnSectionStarts,
  resolveZdEstimateScrollableColumnOrder,
  resolveZdEstimateVisibleColumnOrder,
  serializeZdEstimateUiPrefs,
  toggleZdEstimateColumnVisibility,
  toggleZdEstimateFavorite,
  zdEstimateUiPrefsEqual,
  zdEstimateUiPrefsFromProfilePreferences,
  ZD_ESTIMATE_COLUMN_ORDER_DEFAULTS,
  ZD_ESTIMATE_COLUMN_VISIBILITY_DEFAULTS,
  ZD_ESTIMATE_FAVORITE_GROUPS_SEED,
  ZD_ESTIMATE_FAVORITE_SCOPE_CAP,
  ZD_ESTIMATE_PREFS_KEY,
  ZD_ESTIMATE_UI_PREFS_DEFAULTS,
  type ZdEstimateOptionalColumn,
} from "./zd-estimate-prefs";

describe("parseZdEstimateUiPrefs", () => {
  it("puste / śmieci → defaults (w tym seed ulubionych grup)", () => {
    expect(parseZdEstimateUiPrefs(null)).toEqual(ZD_ESTIMATE_UI_PREFS_DEFAULTS);
    expect(parseZdEstimateUiPrefs({ boost: "aggressive" })).toEqual(
      ZD_ESTIMATE_UI_PREFS_DEFAULTS
    );
    expect(parseZdEstimateUiPrefs(null).favoriteGroups).toEqual(
      ZD_ESTIMATE_FAVORITE_GROUPS_SEED.map((f) => ({ ...f }))
    );
    expect(parseZdEstimateUiPrefs(null).favoriteCechy).toEqual([]);
  });

  it("nie wpuszcza boostu do serializacji", () => {
    const raw = parseZdEstimateUiPrefs({
      zapasMin: 2,
      sortKey: "confidence",
      sortDir: "asc",
      boostPreset: "aggressive",
      listFilter: "review",
      dniZapasu: 21,
    });
    expect(raw.zapasMin).toBe(2);
    expect(raw.sortKey).toBe("confidence");
    expect(raw.listFilter).toBe("review");
    expect(raw.dniZapasu).toBe(21);
    expect(JSON.stringify(serializeZdEstimateUiPrefs(raw))).not.toMatch(
      /boost/i
    );
  });

  it("merge nie kasuje innych kluczy profilu", () => {
    const next = mergeZdEstimateUiPrefsIntoPreferences(
      { uniform_background: true, zd_estimate: { zapasMin: 1 } },
      { showZkColumn: true, listFilter: "all" }
    );
    expect(next.uniform_background).toBe(true);
    const parsed = zdEstimateUiPrefsFromProfilePreferences(next);
    expect(parsed.zapasMin).toBe(1);
    expect(parsed.showZkColumn).toBe(true);
    expect(parsed.columns.zk).toBe(true);
    expect(parsed.listFilter).toBe("all");
    expect(next[ZD_ESTIMATE_PREFS_KEY]).toBeTruthy();
  });

  it("migruje legacy showStockDetail / showZkColumn do columns", () => {
    const parsed = parseZdEstimateUiPrefs({
      showStockDetail: true,
      showZkColumn: true,
    });
    expect(parsed.columns.stock).toBe(true);
    expect(parsed.columns.zk).toBe(true);
    expect(parsed.columns.packaging).toBe(true);
  });

  it("columns nadpisuje legacy flagi", () => {
    const parsed = parseZdEstimateUiPrefs({
      showStockDetail: true,
      showZkColumn: true,
      columns: {
        stock: false,
        zk: false,
        packaging: false,
        status: true,
        available: true,
        sales: false,
        target: true,
        openZd: true,
      },
    });
    expect(parsed.columns.stock).toBe(false);
    expect(parsed.columns.zk).toBe(false);
    expect(parsed.columns.packaging).toBe(false);
    expect(parsed.columns.sales).toBe(false);
    expect(parsed.showStockDetail).toBe(false);
    expect(parsed.showZkColumn).toBe(false);
  });

  it("brak klucza favoriteGroups → seed; [] zostaje puste", () => {
    expect(parseZdEstimateUiPrefs({ zapasMin: 1 }).favoriteGroups).toEqual(
      ZD_ESTIMATE_FAVORITE_GROUPS_SEED.map((f) => ({ ...f }))
    );
    expect(
      parseZdEstimateUiPrefs({ favoriteGroups: [] }).favoriteGroups
    ).toEqual([]);
    expect(
      parseZdEstimateUiPrefs({
        favoriteGroups: [{ id: 99, label: "X" }],
      }).favoriteGroups
    ).toEqual([{ id: 99, label: "X" }]);
  });

  it("brak klucza favoriteCechy → []; [] zostaje puste", () => {
    expect(parseZdEstimateUiPrefs({ zapasMin: 1 }).favoriteCechy).toEqual([]);
    expect(parseZdEstimateUiPrefs({ favoriteCechy: [] }).favoriteCechy).toEqual(
      []
    );
  });

  it("serialize zawsze zapisuje klucze ulubionych (pustka ≠ seed)", () => {
    const cleared = parseZdEstimateUiPrefs({
      favoriteGroups: [],
      favoriteCechy: [],
    });
    const blob = serializeZdEstimateUiPrefs(cleared);
    expect(blob.favoriteGroups).toEqual([]);
    expect(blob.favoriteCechy).toEqual([]);
    expect(parseZdEstimateUiPrefs(blob).favoriteGroups).toEqual([]);
  });

  it("merge favoriteGroups: [] nie przywraca seedu", () => {
    const seeded = mergeZdEstimateUiPrefsIntoPreferences({}, {});
    expect(
      zdEstimateUiPrefsFromProfilePreferences(seeded).favoriteGroups.length
    ).toBeGreaterThan(0);
    const cleared = mergeZdEstimateUiPrefsIntoPreferences(seeded, {
      favoriteGroups: [],
    });
    expect(
      zdEstimateUiPrefsFromProfilePreferences(cleared).favoriteGroups
    ).toEqual([]);
  });

  it("equal uwzględnia ulubione", () => {
    const a = parseZdEstimateUiPrefs({ favoriteGroups: [{ id: 1, label: "A" }] });
    const b = parseZdEstimateUiPrefs({ favoriteGroups: [{ id: 1, label: "A" }] });
    const c = parseZdEstimateUiPrefs({ favoriteGroups: [{ id: 2, label: "B" }] });
    expect(zdEstimateUiPrefsEqual(a, b)).toBe(true);
    expect(zdEstimateUiPrefsEqual(a, c)).toBe(false);
  });
});

describe("toggleZdEstimateFavorite", () => {
  it("dodaje / usuwa; cap bez dodania", () => {
    const a = toggleZdEstimateFavorite([], { id: 1, label: "A" });
    expect(a).toEqual({
      ok: true,
      next: [{ id: 1, label: "A" }],
      added: true,
    });
    expect(isZdEstimateFavorite(a.next, 1)).toBe(true);
    const removed = toggleZdEstimateFavorite(a.next, { id: 1, label: "A" });
    expect(removed.next).toEqual([]);
    expect(removed.added).toBe(false);

    const full = Array.from(
      { length: ZD_ESTIMATE_FAVORITE_SCOPE_CAP },
      (_, i) => ({
        id: i + 1,
        label: `G${i + 1}`,
      })
    );
    const capped = toggleZdEstimateFavorite(full, {
      id: 999,
      label: "Nope",
    });
    expect(capped.ok).toBe(false);
    if (!capped.ok) expect(capped.reason).toBe("at_cap");
    expect(capped.next).toHaveLength(ZD_ESTIMATE_FAVORITE_SCOPE_CAP);
  });

  it("parseFavoriteRefs: dedupe, cap, whenMissing", () => {
    expect(
      parseZdEstimateFavoriteRefs(undefined, [{ id: 7, label: "S" }])
    ).toEqual([{ id: 7, label: "S" }]);
    expect(
      parseZdEstimateFavoriteRefs([
        { id: 1, label: "A" },
        { id: 1, label: "B" },
        { id: 0, label: "bad" },
        { id: 2, label: "  " },
      ])
    ).toEqual([
      { id: 1, label: "A" },
      { id: 2, label: "#2" },
    ]);
  });
});

describe("parseZdEstimateColumnOrder", () => {
  it("uzupełnia brakujące klucze na końcu", () => {
    expect(parseZdEstimateColumnOrder(["sales", "packaging"])).toEqual([
      "sales",
      "packaging",
      "status",
      "stock",
      "available",
      "target",
      "openZd",
      "zk",
    ]);
  });

  it("odrzuca duplikaty i śmieci", () => {
    expect(
      parseZdEstimateColumnOrder(["zk", "zk", "nope", 3, "status"])
    ).toEqual([
      "zk",
      "status",
      "packaging",
      "stock",
      "available",
      "sales",
      "target",
      "openZd",
    ]);
  });

  it("move zamienia sąsiadów", () => {
    const base = [...ZD_ESTIMATE_COLUMN_ORDER_DEFAULTS];
    const up = moveZdEstimateColumnOrder(base, "status", "up");
    expect(up[0]).toBe("status");
    expect(up[1]).toBe("packaging");
    const down = moveZdEstimateColumnOrder(base, "packaging", "down");
    expect(down[0]).toBe("status");
    expect(down[1]).toBe("packaging");
  });

  it("resolve widocznych w kolejności", () => {
    const columns = {
      ...ZD_ESTIMATE_COLUMN_VISIBILITY_DEFAULTS,
      packaging: false,
      stock: true,
    };
    const order = parseZdEstimateColumnOrder([
      "sales",
      "packaging",
      "stock",
      "status",
    ]);
    expect(resolveZdEstimateVisibleColumnOrder(columns, order)).toEqual([
      "sales",
      "stock",
      "status",
      "available",
      "target",
      "openZd",
    ]);
  });

  it("section starts tylko przy zmianie grupy (flow = Dost/Sprzed/Cel/Otwarte)", () => {
    const starts = resolveZdEstimateColumnSectionStarts([
      "status",
      "available",
      "sales",
      "target",
      "openZd",
      "zk",
    ]);
    expect([...starts]).toEqual(["available", "zk"]);
  });

  it("scrollable bez Opak. (pinowane przed Do ZD)", () => {
    expect(
      resolveZdEstimateScrollableColumnOrder(
        ZD_ESTIMATE_COLUMN_VISIBILITY_DEFAULTS,
        ZD_ESTIMATE_COLUMN_ORDER_DEFAULTS
      )
    ).not.toContain("packaging");
    expect(
      resolveZdEstimateScrollableColumnOrder(
        ZD_ESTIMATE_COLUMN_VISIBILITY_DEFAULTS,
        ZD_ESTIMATE_COLUMN_ORDER_DEFAULTS
      )[0]
    ).toBe("status");
  });

  it("merge zapisuje columnOrder", () => {
    const next = mergeZdEstimateUiPrefsIntoPreferences(
      { zd_estimate: { zapasMin: 1 } },
      { columnOrder: ["zk", "sales"] as ZdEstimateOptionalColumn[] }
    );
    const parsed = zdEstimateUiPrefsFromProfilePreferences(next);
    expect(parsed.columnOrder[0]).toBe("zk");
    expect(parsed.columnOrder[1]).toBe("sales");
    expect(parsed.columnOrder).toHaveLength(8);
  });

  it("round-trip: widoczność + kolejność przeżywają zapis profilu", () => {
    const columns = {
      ...ZD_ESTIMATE_COLUMN_VISIBILITY_DEFAULTS,
      stock: true,
      zk: true,
      sales: false,
      status: false,
    };
    const columnOrder: ZdEstimateOptionalColumn[] = [
      "zk",
      "stock",
      "target",
      "openZd",
      "available",
      "sales",
      "status",
      "packaging",
    ];
    const saved = mergeZdEstimateUiPrefsIntoPreferences(
      { theme: "x", zd_estimate: { zapasMin: 3, listFilter: "all" } },
      { columns, columnOrder, sortKey: "symbol", sortDir: "asc" }
    );
    expect(saved.theme).toBe("x");
    const blob = saved[ZD_ESTIMATE_PREFS_KEY] as Record<string, unknown>;
    expect(blob.columns).toEqual(columns);
    expect(blob.columnOrder).toEqual(columnOrder);
    expect(blob.showZkColumn).toBe(true);
    expect(blob.showStockDetail).toBe(true);

    const reloaded = zdEstimateUiPrefsFromProfilePreferences(saved);
    expect(reloaded.columns).toEqual(columns);
    expect(reloaded.columnOrder).toEqual(columnOrder);
    expect(reloaded.zapasMin).toBe(3);
    expect(reloaded.listFilter).toBe("all");
    expect(reloaded.sortKey).toBe("symbol");
    expect(
      resolveZdEstimateScrollableColumnOrder(
        reloaded.columns,
        reloaded.columnOrder
      )
    ).toEqual(["zk", "stock", "target", "openZd", "available"]);
  });

  it("merge samego columnOrder nie kasuje columns", () => {
    const seed = mergeZdEstimateUiPrefsIntoPreferences(
      {},
      {
        columns: {
          ...ZD_ESTIMATE_COLUMN_VISIBILITY_DEFAULTS,
          packaging: false,
          zk: true,
        },
      }
    );
    const next = mergeZdEstimateUiPrefsIntoPreferences(seed, {
      columnOrder: ["openZd", "sales", "target"] as ZdEstimateOptionalColumn[],
    });
    const parsed = zdEstimateUiPrefsFromProfilePreferences(next);
    expect(parsed.columns.packaging).toBe(false);
    expect(parsed.columns.zk).toBe(true);
    expect(parsed.columnOrder[0]).toBe("openZd");
  });

  it("merge samego columns nie kasuje columnOrder", () => {
    const seed = mergeZdEstimateUiPrefsIntoPreferences(
      {},
      {
        columnOrder: [
          "zk",
          "sales",
          "packaging",
          "status",
          "stock",
          "available",
          "target",
          "openZd",
        ] as ZdEstimateOptionalColumn[],
      }
    );
    const next = mergeZdEstimateUiPrefsIntoPreferences(seed, {
      columns: {
        ...ZD_ESTIMATE_COLUMN_VISIBILITY_DEFAULTS,
        sales: false,
      },
    });
    const parsed = zdEstimateUiPrefsFromProfilePreferences(next);
    expect(parsed.columnOrder[0]).toBe("zk");
    expect(parsed.columnOrder[1]).toBe("sales");
    expect(parsed.columns.sales).toBe(false);
  });
});

describe("parseZdEstimateColumnVisibility", () => {
  it("toggle odwraca jedną kolumnę", () => {
    const next = toggleZdEstimateColumnVisibility(
      ZD_ESTIMATE_COLUMN_VISIBILITY_DEFAULTS,
      "sales"
    );
    expect(next.sales).toBe(false);
    expect(next.packaging).toBe(true);
  });

  it("puste columns → defaults z legacy", () => {
    expect(
      parseZdEstimateColumnVisibility(null, { showStockDetail: true })
    ).toEqual({
      ...ZD_ESTIMATE_COLUMN_VISIBILITY_DEFAULTS,
      stock: true,
    });
  });
});
