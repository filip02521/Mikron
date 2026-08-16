import { describe, expect, it } from "vitest";
import {
  mergeZdEstimateUiPrefsIntoPreferences,
  moveZdEstimateColumnOrder,
  parseZdEstimateColumnOrder,
  parseZdEstimateColumnVisibility,
  parseZdEstimateUiPrefs,
  resolveZdEstimateColumnSectionStarts,
  resolveZdEstimateScrollableColumnOrder,
  resolveZdEstimateVisibleColumnOrder,
  serializeZdEstimateUiPrefs,
  toggleZdEstimateColumnVisibility,
  zdEstimateUiPrefsFromProfilePreferences,
  ZD_ESTIMATE_COLUMN_ORDER_DEFAULTS,
  ZD_ESTIMATE_COLUMN_VISIBILITY_DEFAULTS,
  ZD_ESTIMATE_PREFS_KEY,
  ZD_ESTIMATE_UI_PREFS_DEFAULTS,
  type ZdEstimateOptionalColumn,
} from "./zd-estimate-prefs";

describe("parseZdEstimateUiPrefs", () => {
  it("puste / śmieci → defaults", () => {
    expect(parseZdEstimateUiPrefs(null)).toEqual(ZD_ESTIMATE_UI_PREFS_DEFAULTS);
    expect(parseZdEstimateUiPrefs({ boost: "aggressive" })).toEqual(
      ZD_ESTIMATE_UI_PREFS_DEFAULTS
    );
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
