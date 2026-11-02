import { describe, expect, it } from "vitest";
import { zdLineDecisionCorrection, zdLineDecisionPattern, type ZdLineDecisionRow } from "@/lib/data/zd-line-decisions";

const row = (proposed: number, final: number, reason: string | null = null, i = 0): ZdLineDecisionRow => ({
  twId: 1,
  proposedUnits: proposed,
  finalUnits: final,
  reason,
  decidedAt: `2026-10-${String(28 - i).padStart(2, "0")}T10:00:00.000Z`,
  priceNet: null,
  patternFactor: null,
});

describe("zdLineDecisionPattern", () => {
  it("3 z 4 ostatnich podniesione ≥ 1,5× → wzorzec „up” z medianą, w granicach 0,5–2", () => {
    const p = zdLineDecisionPattern([row(3, 8), row(6, 15), row(4, 4), row(2, 5)]);
    expect(p).toEqual({ kind: "up", factor: 2, agree: 3, of: 4 });
  });

  it("3 z 4 zdjęte z listy → „drop”; 3 z 4 obniżone → „down”", () => {
    expect(zdLineDecisionPattern([row(1, 0), row(1, 0), row(2, 2), row(1, 0)])).toEqual({ kind: "drop", factor: 0, agree: 3, of: 4 });
    expect(zdLineDecisionPattern([row(10, 5), row(10, 6), row(10, 10), row(10, 5)])).toEqual({ kind: "down", factor: 0.5, agree: 3, of: 4 });
  });

  it("decyzje pod klienta / promocję i dopisane ręcznie nie budują wzorca; mniej niż 3 decyzje → brak", () => {
    expect(zdLineDecisionPattern([row(3, 8, "klient"), row(3, 8, "promocja"), row(3, 8), row(3, 8)])).toBeNull();
    expect(zdLineDecisionPattern([row(0, 8), row(0, 8), row(0, 8), row(3, 8)])).toBeNull();
    expect(zdLineDecisionPattern([row(3, 8), row(3, 8)])).toBeNull();
    expect(zdLineDecisionPattern([row(3, 3), row(3, 8), row(3, 1), row(3, 3)])).toBeNull();
  });

  it("patrzy tylko na 4 ostatnie (najnowsze pierwsze)", () => {
    expect(zdLineDecisionPattern([row(3, 3), row(3, 3), row(3, 3), row(3, 3), row(3, 9), row(3, 9), row(3, 9)])).toBeNull();
  });
});

describe("zdLineDecisionCorrection", () => {
  it("w jednostkach, gdy brak cen: 16 z 29 linii nie zamówionych + 5 podniesionych (Polkard 21–22.10)", () => {
    const rows = [
      ...Array.from({ length: 16 }, (_, i) => ({ ...row(1, 0), twId: i + 1, dokId: 214 })),
      ...Array.from({ length: 5 }, (_, i) => ({ ...row(2, 4), twId: 100 + i, dokId: 214 })),
      ...Array.from({ length: 8 }, (_, i) => ({ ...row(2, 2), twId: 200 + i, dokId: 214 })),
      ...Array.from({ length: 6 }, (_, i) => ({ ...row(0, 2), twId: 300 + i, dokId: 214 })),
    ];
    const c = zdLineDecisionCorrection(rows);
    // propozycja 16×1 + 5×2 + 8×2 = 42 j.; zmienione 16 + 5×2 = 26 j. → 61,9 %
    expect(c).toEqual({ pct: 61.9, lines: 29, changed: 21, dropped: 16, added: 6, zdCount: 1, priced: 0 });
  });

  it("po wartości, gdy każda linia ma cenę", () => {
    const rows = [
      { ...row(10, 10), twId: 1, dokId: 1, priceNet: 100 },
      { ...row(10, 0), twId: 2, dokId: 1, priceNet: 1 },
    ];
    const c = zdLineDecisionCorrection(rows);
    expect(c.pct).toBeCloseTo(1, 5);
    expect(c.priced).toBe(2);
  });
});

describe("zdLineDecisionPattern — mnożnik już w propozycji", () => {
  it("akceptacja dopasowanej ilości (final = proposed przy mnożniku 2) utrzymuje wzorzec „up”", () => {
    const rows = [row(6, 6), row(6, 6), row(6, 6), row(3, 7)].map((r, i) => ({ ...r, patternFactor: i < 3 ? 2 : null }));
    expect(zdLineDecisionPattern(rows)).toEqual({ kind: "up", factor: 2, agree: 4, of: 4 });
  });
});
