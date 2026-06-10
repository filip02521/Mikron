import { describe, expect, it } from "vitest";
import {
  collapseAllZkMonthGroups,
  defaultCollapsedZkMonthKeys,
  expandAllZkMonthGroups,
  expandMonthGroupKey,
  isZkMonthGroupExpanded,
  mergeZkMonthCollapseOnGroupsChange,
  monthKeyForWatchInGroups,
  toggleZkMonthGroupCollapsed,
} from "./zk-watch-month-collapse";
import type { ZkWatchMonthGroup } from "./zk-watch-sort";

function groups(keys: string[]): ZkWatchMonthGroup[] {
  return keys.map((key) => ({
    key,
    label: key,
    watches: [{ id: key } as ZkWatchMonthGroup["watches"][number]],
  }));
}

describe("defaultCollapsedZkMonthKeys", () => {
  it("domyślnie rozwija wszystkie miesiące", () => {
    const input: ZkWatchMonthGroup[] = [
      { key: "2026-03", label: "marzec", watches: Array.from({ length: 5 }, (_, i) => ({ id: `m3-${i}` } as never)) },
      { key: "2026-04", label: "kwiecień", watches: [{ id: "a" } as never] },
      { key: "2026-05", label: "maj", watches: Array.from({ length: 4 }, (_, i) => ({ id: `m5-${i}` } as never)) },
    ];
    const collapsed = defaultCollapsedZkMonthKeys(input);
    expect(collapsed.size).toBe(0);
    expect(isZkMonthGroupExpanded("2026-03", collapsed)).toBe(true);
    expect(isZkMonthGroupExpanded("2026-05", collapsed)).toBe(true);
  });
});

describe("toggleZkMonthGroupCollapsed", () => {
  it("przełącza stan grupy", () => {
    const collapsed = collapseAllZkMonthGroups(groups(["2026-03", "2026-04"]));
    const toggled = toggleZkMonthGroupCollapsed(collapsed, "2026-03");
    expect(isZkMonthGroupExpanded("2026-03", toggled)).toBe(true);
    expect(isZkMonthGroupExpanded("2026-04", toggled)).toBe(false);
  });

  it("expandAll czyści zbiór", () => {
    expect(expandAllZkMonthGroups(groups(["2026-03"])).size).toBe(0);
  });
});

describe("mergeZkMonthCollapseOnGroupsChange", () => {
  it("zachowuje zwinięte miesiące i usuwa nieistniejące klucze", () => {
    const previous = new Set(["2026-03", "2026-01"]);
    const nextGroups = groups(["2026-03", "2026-04"]);
    const merged = mergeZkMonthCollapseOnGroupsChange(previous, nextGroups);
    expect([...merged]).toEqual(["2026-03"]);
    expect(isZkMonthGroupExpanded("2026-04", merged)).toBe(true);
  });
});

describe("monthKeyForWatchInGroups", () => {
  it("znajduje miesiąc dla karty ZK", () => {
    const input: ZkWatchMonthGroup[] = [
      {
        key: "2026-03",
        label: "marzec",
        watches: [{ id: "w1" } as never, { id: "w2" } as never],
      },
      { key: "2026-04", label: "kwiecień", watches: [{ id: "w3" } as never] },
    ];
    expect(monthKeyForWatchInGroups(input, "w2")).toBe("2026-03");
    expect(monthKeyForWatchInGroups(input, "missing")).toBeNull();
    const collapsed = collapseAllZkMonthGroups(input);
    const expanded = expandMonthGroupKey(collapsed, "2026-03");
    expect(isZkMonthGroupExpanded("2026-03", expanded)).toBe(true);
  });
});
