import { describe, expect, it } from "vitest";
import {
  assertBoostPolicySafe,
  normalizeZdBoostPowerPreset,
  parseZdBoostPowerPresetSetting,
  policyForBoostPreset,
  ZD_BOOST_POWER_DEFAULT,
  ZD_BOOST_POWER_PRESET_IDS,
} from "./zd-estimate-boost-presets";
import {
  computeSalesTrackedCel,
  reconcileSalesTrackQtyMetaAfterHistory,
  ZD_SALES_TRACK,
} from "./zd-estimate-sales-track";

const IDS = ZD_BOOST_POWER_PRESET_IDS;

describe("zd-estimate-boost-presets", () => {
  it("default = gentle; unknown → gentle", () => {
    expect(ZD_BOOST_POWER_DEFAULT).toBe("gentle");
    expect(normalizeZdBoostPowerPreset("nope")).toBe("gentle");
    expect(parseZdBoostPowerPresetSetting(null)).toBe("gentle");
    expect(parseZdBoostPowerPresetSetting({ preset: "aggressive" })).toBe(
      "aggressive"
    );
  });

  it("knobs table: cap/ST/ramp/days/confMin; reviewMax nietknięty", () => {
    const expected = {
      off: { cap: 0, st: 0, ramp: 0, days: 0, confMin: 0.5 },
      gentle: { cap: 0.2, st: 0.08, ramp: 0.25, days: 6, confMin: 0.55 },
      standard: { cap: 0.35, st: 0.15, ramp: 0.4, days: 10, confMin: 0.5 },
      aggressive: { cap: 0.5, st: 0.22, ramp: 0.55, days: 14, confMin: 0.45 },
    } as const;
    for (const id of IDS) {
      const p = policyForBoostPreset(id);
      const e = expected[id];
      expect(p.maxTotalBoostRatio).toBe(e.cap);
      expect(p.sellThroughMaxBoost).toBe(e.st);
      expect(p.coverRamp).toBe(e.ramp);
      expect(p.maxCoverExtraDays).toBe(e.days);
      expect(p.boostQtyConfidenceMin).toBe(e.confMin);
      expect(p.boostQtyReviewConfidenceMax).toBe(0.75);
      expect(p.maxTotalCutRatio).toBe(ZD_SALES_TRACK.maxTotalCutRatio);
    }
  });

  it("wszystkie presety przechodzą assertBoostPolicySafe", () => {
    for (const id of IDS) {
      expect(() => policyForBoostPreset(id)).not.toThrow();
      assertBoostPolicySafe(policyForBoostPreset(id));
    }
  });

  it("standard ≡ ZD_SALES_TRACK i ≡ brak policy w compute", () => {
    expect(policyForBoostPreset("standard")).toEqual(ZD_SALES_TRACK);
    const f = {
      celZapasu: 60,
      sprzedazOkres: 12,
      sprzedazDziennie: 2,
      dostepne: 0,
      dniZapasu: 30,
      dniOkresu: 30,
    };
    const withStd = computeSalesTrackedCel({
      ...f,
      policy: policyForBoostPreset("standard"),
    });
    const without = computeSalesTrackedCel(f);
    expect(withStd).toEqual(without);
  });

  it("off: allowedExtra=0 na thin high-conf; cut fat ≡ wszystkie; ≠ salesTrack:false", () => {
    const thin = {
      celZapasu: 60,
      sprzedazOkres: 12,
      sprzedazDziennie: 2,
      dostepne: 0,
      dniZapasu: 30,
      dniOkresu: 30,
    };
    const offThin = computeSalesTrackedCel({
      ...thin,
      policy: policyForBoostPreset("off"),
    });
    expect(offThin.allowedExtraQty).toBe(0);
    expect(offThin.reasons).not.toContain("thin_cover");
    expect(offThin.reasons).not.toContain("sell_through");

    const fat = {
      celZapasu: 30,
      sprzedazOkres: 8,
      sprzedazDziennie: 1,
      dostepne: 90,
      dniZapasu: 30,
      dniOkresu: 30,
    };
    const fatResults = IDS.map((id) =>
      computeSalesTrackedCel({ ...fat, policy: policyForBoostPreset(id) })
    );
    for (let i = 1; i < fatResults.length; i++) {
      expect(fatResults[i]!.celTracked).toBeCloseTo(
        fatResults[0]!.celTracked,
        9
      );
      expect(fatResults[i]!.reasons).toEqual(fatResults[0]!.reasons);
    }
    expect(fatResults[0]!.celTracked).toBeCloseTo(21, 9);

    const trackOff = computeSalesTrackedCel({ ...fat, enabled: false });
    expect(trackOff.celTracked).toBe(30);
    expect(trackOff.reasons).toEqual([]);
  });

  it("monotoniczność allowedExtra: off≤gentle≤standard≤aggressive", () => {
    const fixtures = [
      {
        celZapasu: 60,
        sprzedazOkres: 12,
        sprzedazDziennie: 2,
        dostepne: 0,
        dniZapasu: 30,
        dniOkresu: 30,
      },
      {
        celZapasu: 30,
        sprzedazOkres: 4,
        sprzedazDziennie: 1,
        dostepne: 1,
        dniZapasu: 30,
        dniOkresu: 30,
      },
      {
        celZapasu: 50,
        sprzedazOkres: 40,
        sprzedazDziennie: 40 / 30,
        dostepne: 5,
        dniZapasu: 30,
        dniOkresu: 30,
      },
    ];
    for (const f of fixtures) {
      const vals = IDS.map(
        (id) =>
          computeSalesTrackedCel({
            ...f,
            policy: policyForBoostPreset(id),
          }).allowedExtraQty
      );
      for (let i = 1; i < vals.length; i++) {
        expect(vals[i]!).toBeGreaterThanOrEqual(vals[i - 1]!);
      }
    }
  });

  it("fixture thin high-conf: gentle +12, standard +21, aggressive +30", () => {
    const f = {
      celZapasu: 60,
      sprzedazOkres: 12,
      sprzedazDziennie: 2,
      dostepne: 0,
      dniZapasu: 30,
      dniOkresu: 30,
    };
    expect(
      computeSalesTrackedCel({
        ...f,
        policy: policyForBoostPreset("off"),
      }).allowedExtraQty
    ).toBe(0);
    expect(
      computeSalesTrackedCel({
        ...f,
        policy: policyForBoostPreset("gentle"),
      }).allowedExtraQty
    ).toBe(12);
    expect(
      computeSalesTrackedCel({
        ...f,
        policy: policyForBoostPreset("standard"),
      }).allowedExtraQty
    ).toBe(21);
    expect(
      computeSalesTrackedCel({
        ...f,
        policy: policyForBoostPreset("aggressive"),
      }).allowedExtraQty
    ).toBe(30);
  });

  it("fixture thin mid-conf: gentle hold 0; standard +6; aggressive +8", () => {
    const f = {
      celZapasu: 30,
      sprzedazOkres: 4,
      sprzedazDziennie: 1,
      dostepne: 1,
      dniZapasu: 30,
      dniOkresu: 30,
    };
    const g = computeSalesTrackedCel({
      ...f,
      policy: policyForBoostPreset("gentle"),
    });
    const s = computeSalesTrackedCel({
      ...f,
      policy: policyForBoostPreset("standard"),
    });
    const a = computeSalesTrackedCel({
      ...f,
      policy: policyForBoostPreset("aggressive"),
    });
    expect(g.confidence).toBeCloseTo(0.5475, 4);
    expect(g.allowedExtraQty).toBe(0);
    expect(g.reasons).toContain("boost_held");
    expect(s.allowedExtraQty).toBe(6);
    expect(a.allowedExtraQty).toBe(8);
  });

  it("fixture thin niska conf: hold we wszystkich (allowedExtra=0)", () => {
    const f = {
      celZapasu: 30,
      sprzedazOkres: 2,
      sprzedazDziennie: 2 / 30,
      dostepne: 0,
      dniZapasu: 30,
      dniOkresu: 30,
    };
    for (const id of IDS) {
      const r = computeSalesTrackedCel({
        ...f,
        policy: policyForBoostPreset(id),
      });
      expect(r.confidence).toBeCloseTo(0.2, 4);
      expect(r.allowedExtraQty).toBe(0);
    }
  });

  it("cover w deadband: brak thin_cover; ST może dokładać (nie off)", () => {
    // coverDays = 30 (w deadband) → thin_cover nie wchodzi.
    // sellThrough ≈ 0.5 nadal może dać +1 (poza off).
    const f = {
      celZapasu: 30,
      sprzedazOkres: 30,
      sprzedazDziennie: 1,
      dostepne: 30,
      dniZapasu: 30,
      dniOkresu: 30,
    };
    for (const id of IDS) {
      const r = computeSalesTrackedCel({
        ...f,
        policy: policyForBoostPreset(id),
      });
      expect(r.reasons).not.toContain("thin_cover");
      expect(r.reasons).not.toContain("fat_cover");
    }
    expect(
      computeSalesTrackedCel({
        ...f,
        policy: policyForBoostPreset("off"),
      }).allowedExtraQty
    ).toBe(0);
    expect(
      computeSalesTrackedCel({
        ...f,
        policy: policyForBoostPreset("gentle"),
      }).allowedExtraQty
    ).toBe(1);
  });

  it("fixture pure ST (cover OK): off 0; pozostałe +1", () => {
    const f = {
      celZapasu: 100,
      sprzedazOkres: 90,
      sprzedazDziennie: 3,
      dostepne: 90,
      dniZapasu: 30,
      dniOkresu: 30,
    };
    expect(
      computeSalesTrackedCel({
        ...f,
        policy: policyForBoostPreset("off"),
      }).allowedExtraQty
    ).toBe(0);
    for (const id of ["gentle", "standard", "aggressive"] as const) {
      expect(
        computeSalesTrackedCel({
          ...f,
          policy: policyForBoostPreset(id),
        }).allowedExtraQty
      ).toBe(1);
    }
  });

  it("reconcileAfterHistory honoruje policy.boostQtyReviewConfidenceMax", () => {
    const base = {
      celBase: 10,
      celTracked: 20,
      coverStock: 0,
      confidence: 0.7,
      reasons: ["thin_cover" as const],
    };
    const defaultReview = reconcileSalesTrackQtyMetaAfterHistory(base);
    expect(defaultReview.salesTrackQtyReview).toBe(true);
    expect(defaultReview.salesTrackAllowedExtraQty).toBe(10);

    const highGate = reconcileSalesTrackQtyMetaAfterHistory({
      ...base,
      policy: {
        boostQtyReviewConfidenceMax: 0.65,
      } as unknown as Partial<typeof ZD_SALES_TRACK>,
    });
    // 0.7 >= 0.65 → bez review
    expect(highGate.salesTrackQtyReview).toBe(false);
    expect(highGate.salesTrackAllowedExtraQty).toBe(10);

    const withStdPolicy = reconcileSalesTrackQtyMetaAfterHistory({
      ...base,
      policy: policyForBoostPreset("standard"),
    });
    expect(withStdPolicy).toEqual(defaultReview);
  });
});
