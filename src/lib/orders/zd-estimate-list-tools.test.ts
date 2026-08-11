import { describe, expect, it } from "vitest";
import {
  filterZdEstimateLinesBySearch,
  resolveZdEstimateListToolStates,
  resolveZdEstimateListToolsMode,
  zdEstimateSelectionOutsideVisibleHint,
} from "./zd-estimate-list-tools";

const trusted = {
  pairsTrusted: true,
  bomsTrusted: true,
  packagingTrusted: true,
  exclusionsTrusted: true,
  onRequestTrusted: true,
};

describe("resolveZdEstimateListToolsMode", () => {
  it("panels przy 0, selection przy ≥1", () => {
    expect(resolveZdEstimateListToolsMode(0)).toBe("panels");
    expect(resolveZdEstimateListToolsMode(1)).toBe("selection");
    expect(resolveZdEstimateListToolsMode(5)).toBe("selection");
  });
});

describe("resolveZdEstimateListToolStates", () => {
  it("przy 1: Opakowanie+Wyklucz accent tylko gdy enabled", () => {
    const s = resolveZdEstimateListToolStates({
      selectedCount: 1,
      excludeEligibleCount: 1,
      restoreEligibleCount: 0,
      onRequestEligibleCount: 0,
      clearOnRequestEligibleCount: 0,
      packagingClearEligibleCount: 0,
      ...trusted,
    });
    expect(s.pair.enabled).toBe(false);
    expect(s.pair.accent).toBe(false);
    expect(s.bom.enabled).toBe(false);
    expect(s.bom.accent).toBe(false);
    expect(s.packagingSet.enabled).toBe(true);
    expect(s.packagingSet.accent).toBe(true);
    expect(s.exclude.enabled).toBe(true);
    expect(s.exclude.accent).toBe(true);
    expect(s.restore.enabled).toBe(false);
    expect(s.restore.accent).toBe(false);
    expect(s.packagingClear.enabled).toBe(false);
  });

  it("przy 1 z restore: Przywróć accent, nie Para/Skład", () => {
    const s = resolveZdEstimateListToolStates({
      selectedCount: 1,
      excludeEligibleCount: 0,
      restoreEligibleCount: 1,
      onRequestEligibleCount: 0,
      clearOnRequestEligibleCount: 0,
      packagingClearEligibleCount: 0,
      ...trusted,
    });
    expect(s.restore.enabled).toBe(true);
    expect(s.restore.accent).toBe(true);
    expect(s.exclude.accent).toBe(false);
  });

  it("przy 2: Para accent i enabled, Skład enabled bez accent", () => {
    const s = resolveZdEstimateListToolStates({
      selectedCount: 2,
      excludeEligibleCount: 2,
      restoreEligibleCount: 0,
      onRequestEligibleCount: 0,
      clearOnRequestEligibleCount: 0,
      packagingClearEligibleCount: 1,
      ...trusted,
    });
    expect(s.pair.enabled).toBe(true);
    expect(s.pair.accent).toBe(true);
    expect(s.bom.enabled).toBe(true);
    expect(s.bom.accent).toBe(false);
    expect(s.packagingClear.enabled).toBe(true);
    expect(s.packagingClear.labelSuffix).toBe(" (1)");
  });

  it("przy 3+: Skład accent, Para disabled bez accent", () => {
    const s = resolveZdEstimateListToolStates({
      selectedCount: 3,
      excludeEligibleCount: 0,
      restoreEligibleCount: 2,
      onRequestEligibleCount: 0,
      clearOnRequestEligibleCount: 0,
      packagingClearEligibleCount: 0,
      ...trusted,
    });
    expect(s.pair.enabled).toBe(false);
    expect(s.pair.accent).toBe(false);
    expect(s.pair.title).toMatch(/dokładnie 2/);
    expect(s.bom.enabled).toBe(true);
    expect(s.bom.accent).toBe(true);
    expect(s.exclude.enabled).toBe(false);
    expect(s.restore.enabled).toBe(true);
  });

  it("trusted=false blokuje Para/Skład/Opakowanie bez false accent", () => {
    const s = resolveZdEstimateListToolStates({
      selectedCount: 2,
      excludeEligibleCount: 2,
      restoreEligibleCount: 0,
      onRequestEligibleCount: 0,
      clearOnRequestEligibleCount: 0,
      packagingClearEligibleCount: 1,
      pairsTrusted: false,
      bomsTrusted: false,
      packagingTrusted: false,
      exclusionsTrusted: true,
      onRequestTrusted: true,
    });
    expect(s.pair.enabled).toBe(false);
    expect(s.pair.accent).toBe(false);
    expect(s.pair.title).toMatch(/Wczytaj pary/);
    expect(s.bom.enabled).toBe(false);
    expect(s.bom.accent).toBe(false);
    expect(s.bom.title).toMatch(/Wczytaj składy/);
    expect(s.packagingSet.enabled).toBe(false);
    expect(s.packagingSet.accent).toBe(false);
    expect(s.packagingSet.title).toMatch(/Wczytaj opakowania/);
    expect(s.packagingClear.enabled).toBe(false);
    expect(s.packagingClear.title).toMatch(/Wczytaj opakowania/);
  });

  it("exclusionsTrusted=false blokuje Wyklucz/Przywróć z title Wczytaj", () => {
    const s = resolveZdEstimateListToolStates({
      selectedCount: 2,
      excludeEligibleCount: 2,
      restoreEligibleCount: 1,
      onRequestEligibleCount: 0,
      clearOnRequestEligibleCount: 0,
      packagingClearEligibleCount: 0,
      pairsTrusted: true,
      bomsTrusted: true,
      packagingTrusted: true,
      exclusionsTrusted: false,
      onRequestTrusted: true,
    });
    expect(s.exclude.enabled).toBe(false);
    expect(s.exclude.accent).toBe(false);
    expect(s.exclude.title).toMatch(/Wczytaj wykluczenia/);
    expect(s.exclude.labelSuffix).toBe("");
    expect(s.restore.enabled).toBe(false);
    expect(s.restore.accent).toBe(false);
    expect(s.restore.title).toMatch(/Wczytaj wykluczenia/);
  });

  it("eligible 0 → disabled + title", () => {
    const s = resolveZdEstimateListToolStates({
      selectedCount: 4,
      excludeEligibleCount: 0,
      restoreEligibleCount: 0,
      onRequestEligibleCount: 0,
      clearOnRequestEligibleCount: 0,
      packagingClearEligibleCount: 0,
      ...trusted,
    });
    expect(s.exclude.enabled).toBe(false);
    expect(s.exclude.title).toMatch(/kwalifikujących/);
    expect(s.restore.enabled).toBe(false);
    expect(s.packagingClear.enabled).toBe(false);
    expect(s.packagingClear.title).toMatch(/Brak pozycji z opakowaniem/);
  });

  it("packagingTrusted=false i eligible>0 → Usuń opak. disabled", () => {
    const s = resolveZdEstimateListToolStates({
      selectedCount: 3,
      excludeEligibleCount: 0,
      restoreEligibleCount: 0,
      onRequestEligibleCount: 0,
      clearOnRequestEligibleCount: 0,
      packagingClearEligibleCount: 5,
      pairsTrusted: true,
      bomsTrusted: true,
      packagingTrusted: false,
      exclusionsTrusted: true,
      onRequestTrusted: true,
    });
    expect(s.packagingClear.enabled).toBe(false);
    expect(s.packagingClear.labelSuffix).toBe("");
    expect(s.packagingClear.title).toMatch(/Wczytaj opakowania/);
  });

  it("onRequestTrusted=false blokuje Na prośbę mimo eligible>0", () => {
    const s = resolveZdEstimateListToolStates({
      selectedCount: 2,
      excludeEligibleCount: 0,
      restoreEligibleCount: 0,
      onRequestEligibleCount: 2,
      clearOnRequestEligibleCount: 1,
      packagingClearEligibleCount: 0,
      pairsTrusted: true,
      bomsTrusted: true,
      packagingTrusted: true,
      exclusionsTrusted: true,
      onRequestTrusted: false,
    });
    expect(s.onRequest.enabled).toBe(false);
    expect(s.onRequest.accent).toBe(false);
    expect(s.onRequest.title).toMatch(/tylko na prośbę/);
    expect(s.onRequest.labelSuffix).toBe("");
    expect(s.clearOnRequest.enabled).toBe(false);
    expect(s.clearOnRequest.title).toMatch(/tylko na prośbę/);
    expect(s.clearOnRequest.labelSuffix).toBe("");
  });

  it("exclusionsTrusted=false blokuje Na prośbę mimo onRequestTrusted", () => {
    const s = resolveZdEstimateListToolStates({
      selectedCount: 2,
      excludeEligibleCount: 0,
      restoreEligibleCount: 0,
      onRequestEligibleCount: 2,
      clearOnRequestEligibleCount: 0,
      packagingClearEligibleCount: 0,
      pairsTrusted: true,
      bomsTrusted: true,
      packagingTrusted: true,
      exclusionsTrusted: false,
      onRequestTrusted: true,
    });
    expect(s.onRequest.enabled).toBe(false);
    expect(s.onRequest.title).toMatch(/Wczytaj wykluczenia/);
    expect(s.onRequest.labelSuffix).toBe("");
  });

  it("onRequestTrusted + eligible → Na prośbę enabled z suffix", () => {
    const s = resolveZdEstimateListToolStates({
      selectedCount: 1,
      excludeEligibleCount: 0,
      restoreEligibleCount: 0,
      onRequestEligibleCount: 1,
      clearOnRequestEligibleCount: 0,
      packagingClearEligibleCount: 0,
      ...trusted,
    });
    expect(s.onRequest.enabled).toBe(true);
    expect(s.onRequest.accent).toBe(true);
    expect(s.onRequest.labelSuffix).toBe(" (1)");
  });

  it("clearOnRequest eligible>0 → enabled z suffix", () => {
    const s = resolveZdEstimateListToolStates({
      selectedCount: 2,
      excludeEligibleCount: 0,
      restoreEligibleCount: 0,
      onRequestEligibleCount: 0,
      clearOnRequestEligibleCount: 2,
      packagingClearEligibleCount: 0,
      ...trusted,
    });
    expect(s.clearOnRequest.enabled).toBe(true);
    expect(s.clearOnRequest.labelSuffix).toBe(" (2)");
  });
});

describe("zdEstimateSelectionOutsideVisibleHint", () => {
  it("null gdy nic poza widokiem", () => {
    expect(zdEstimateSelectionOutsideVisibleHint(3, 3)).toBeNull();
    expect(zdEstimateSelectionOutsideVisibleHint(0, 0)).toBeNull();
  });

  it("odmiana 1 / N", () => {
    expect(zdEstimateSelectionOutsideVisibleHint(2, 1)).toBe(
      "1 poza filtrem/szukaniem"
    );
    expect(zdEstimateSelectionOutsideVisibleHint(5, 2)).toBe(
      "3 poza filtrem/szukaniem"
    );
  });
});

describe("filterZdEstimateLinesBySearch", () => {
  const rows = [
    { tw_Id: 101, tw_Symbol: "ABC-1", tw_Nazwa: "Cement A", tw_PLU: "590123" },
    { tw_Id: 202, tw_Symbol: "XYZ", tw_Nazwa: "Pasta B", tw_PLU: null },
  ];

  it("puste query = bez zmian", () => {
    expect(filterZdEstimateLinesBySearch(rows, "  ")).toEqual(rows);
  });

  it("match po symbolu, nazwie, PLU i id", () => {
    expect(filterZdEstimateLinesBySearch(rows, "abc")).toEqual([rows[0]]);
    expect(filterZdEstimateLinesBySearch(rows, "pasta")).toEqual([rows[1]]);
    expect(filterZdEstimateLinesBySearch(rows, "590")).toEqual([rows[0]]);
    expect(filterZdEstimateLinesBySearch(rows, "202")).toEqual([rows[1]]);
  });
});
