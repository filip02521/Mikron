import { describe, expect, it } from "vitest";
import {
  mergeZdEstimateUiPrefsIntoPreferences,
  parseZdEstimateUiPrefs,
  serializeZdEstimateUiPrefs,
  zdEstimateUiPrefsFromProfilePreferences,
  ZD_ESTIMATE_PREFS_KEY,
  ZD_ESTIMATE_UI_PREFS_DEFAULTS,
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
    expect(parsed.listFilter).toBe("all");
    expect(next[ZD_ESTIMATE_PREFS_KEY]).toBeTruthy();
  });
});
