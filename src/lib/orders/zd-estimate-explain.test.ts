import { describe, expect, it } from "vitest";
import { explainZdOrderQty } from "./zd-estimate-explain";
import { computeZdPackOrderQty } from "./zd-estimate-packaging";
import type { ManualZdEstimateLine } from "./zd-estimate-manual";

const line = (p: Partial<ManualZdEstimateLine>) =>
  ({ celZapasu: 0, celZapasuTracked: 0, dostepne: 0, pair: null, ...p }) as ManualZdEstimateLine;

const byKey = (steps: ReturnType<typeof explainZdOrderQty>) =>
  Object.fromEntries(steps.map((s) => [s.key, s.value]));

describe("explainZdOrderQty", () => {
  it("cel − dostępne − w drodze + prośby → worki → palety", () => {
    // cel 210, dostępne 12, w drodze 50 → brak 148; + prośby 40 → 188 szt → 38 worków → 72 (2 palety po 36)
    const qty = computeZdPackOrderQty(188, 5, "worek", "packages", 36);
    const s = explainZdOrderQty({
      line: line({ celZapasu: 210, celZapasuTracked: 210, dostepne: 12 }),
      qty,
      openZdPieces: 50,
      extraPieces: 40,
      extraOnly: false,
      extrasPolicy: "sum",
    });
    expect(byKey(s)).toMatchObject({ cel: 210, stock: 12, zd: 50, short: 148, extra: 40, need: 188, packs: 38, pallets: 72 });
    expect(s.find((x) => x.key === "pallets")?.label).toContain("2 pal.");
    expect(s.some((x) => x.key === "adjust")).toBe(false);
  });

  it("różnica względem wyliczenia tabeli pokazana jako jawna korekta", () => {
    const qty = computeZdPackOrderQty(180, 5, "worek", "packages", null);
    const s = explainZdOrderQty({
      line: line({ celZapasu: 210, celZapasuTracked: 210, dostepne: 12 }),
      qty,
      openZdPieces: 50,
      extraPieces: 40,
      extraOnly: false,
      extrasPolicy: "sum",
    });
    expect(s.find((x) => x.key === "adjust")).toMatchObject({ value: 8, kind: "minus" });
    expect(byKey(s).need).toBe(180);
  });

  it("minimum stanów wyższe niż cel i ręczne nadpisanie", () => {
    const qty = computeZdPackOrderQty(6, 1, "op.");
    const s = explainZdOrderQty({
      line: line({ celZapasu: 0, celZapasuTracked: 0, dostepne: 4 }),
      qty,
      openZdPieces: 0,
      extraPieces: 0,
      extraOnly: false,
      extrasPolicy: "sum",
      minStockSzt: 10,
      overrideZdUnits: 3,
    });
    expect(s[0]).toMatchObject({ label: "Minimum stanów (wyższe niż cel)", value: 10 });
    expect(s.at(-1)).toMatchObject({ key: "override", value: 3 });
  });
});

describe("explainZdOrderQty — strategia testowa", () => {
  it("podłoga 90 d pokazana jako osobny krok przed celem", () => {
    const qty = computeZdPackOrderQty(10, 1, "op.");
    const s = explainZdOrderQty({
      line: line({ celZapasu: 10, celZapasuTracked: 10, dostepne: 0, demandFloor: { sales90: 36, rateBefore: 0.2, rateAfter: 0.4 } }),
      qty,
      openZdPieces: 0,
      extraPieces: 0,
      extraOnly: false,
      extrasPolicy: "sum",
    });
    expect(s[0]).toMatchObject({ key: "floor", value: 36, kind: "note" });
    expect(s[0]!.label).toContain("6 → 12 szt / 30 d");
  });
});
