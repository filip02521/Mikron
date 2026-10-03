import { describe, expect, it } from "vitest";
import { mapZdEstimateLineToManual } from "@/lib/orders/zd-estimate-manual";
import {
  applyZdSalesProfileToLine,
  classifyZdSalesProfile,
  resolveZdSalesProfile,
  zdSalesProfileWindows,
} from "@/lib/orders/zd-sales-profile";

// Prawdziwe serie z Everall7 (12 × 30 dni, ostatnie okno = okno Kreatora).
const TP045 = [9, 2, 6, 5, 2, 1, 5, 2, 2, 5, 3, 20];
const SAT01 = [0, 0, 0, 0, 0, 0, 0, 2, 1, 0, 0, 6];
const V140ZP02 = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 7];
const V100L05 = [4, 4, 2, 5, 1, 4, 3, 5, 3, 4, 8, 14];
const STEADY = [10, 12, 9, 11, 10, 13, 9, 10, 12, 11, 10, 11];

const classify = (w: number[]) =>
  classifyZdSalesProfile({ windows: w, currentSales: w[w.length - 1]!, currentDays: 30 }).kind;

describe("classifyZdSalesProfile", () => {
  it("rozpoznaje skok, rzadki, nowość, wzrost i regularny", () => {
    expect(classify(TP045)).toBe("spike");
    expect(classify(SAT01)).toBe("rare");
    expect(classify(V140ZP02)).toBe("new");
    expect(classify(V100L05)).toBe("rising");
    expect(classify(STEADY)).toBe("steady");
    expect(classify(Array(12).fill(0))).toBe("none");
  });

  it("jedna sprzedaż po roku ciszy to rzadki, nie nowość", () => {
    expect(classify([0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 20])).toBe("rare");
    expect(classify([0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 3, 0])).toBe("rare");
  });

  it("okno 60 dni pomija dwa ostatnie okna przy liczeniu typowego miesiąca", () => {
    const c = classifyZdSalesProfile({ windows: TP045, currentSales: 46, currentDays: 60 });
    expect(c.currentMonthly).toBe(23);
    expect(c.typicalMonthly).toBe(3.5);
  });
});

describe("resolveZdSalesProfile", () => {
  it("bez wygładzenia tylko klasyfikuje", () => {
    const m = resolveZdSalesProfile({ windows: TP045, sprzedazOkres: 20, dniOkresu: 30, prosbaPieces: 0, smoothing: false });
    expect(m).toEqual(expect.objectContaining({ kind: "spike", applied: false, factor: 1 }));
  });

  it("skok → typowy miesiąc (max z mediany i p75)", () => {
    const m = resolveZdSalesProfile({ windows: TP045, sprzedazOkres: 20, dniOkresu: 30, prosbaPieces: 0, smoothing: true });
    expect(m.applied).toBe(true);
    expect(20 * m.factor).toBe(5);
  });

  it("rzadki → średnia z 12 okien", () => {
    const m = resolveZdSalesProfile({ windows: SAT01, sprzedazOkres: 6, dniOkresu: 30, prosbaPieces: 0, smoothing: true });
    expect(6 * m.factor).toBeCloseTo(0.75);
  });

  it("nowość i wzrost zostają bez zmian", () => {
    for (const w of [V140ZP02, V100L05]) {
      const m = resolveZdSalesProfile({ windows: w, sprzedazOkres: w[11]!, dniOkresu: 30, prosbaPieces: 0, smoothing: true });
      expect(m.applied).toBe(false);
    }
  });

  it("prośby odejmowane przed klasyfikacją — regularny towar bez skoku", () => {
    const m = resolveZdSalesProfile({ windows: STEADY, sprzedazOkres: 15, dniOkresu: 30, prosbaPieces: 4, smoothing: true });
    expect(m.prosbaPieces).toBe(4);
    expect(15 * m.factor).toBeCloseTo(11);
  });

  it("nigdy nie podnosi sprzedaży", () => {
    const m = resolveZdSalesProfile({ windows: STEADY, sprzedazOkres: 2, dniOkresu: 30, prosbaPieces: 0, smoothing: true });
    expect(m.factor).toBe(1);
  });
});

describe("applyZdSalesProfileToLine", () => {
  it("skaluje sprzedaż, tempo i cel (bez minimum) i przelicza doZamowienia", () => {
    const meta = resolveZdSalesProfile({ windows: TP045, sprzedazOkres: 20, dniOkresu: 30, prosbaPieces: 0, smoothing: true });
    const line = applyZdSalesProfileToLine(
      { sprzedazOkres: 20, sprzedazDziennie: 20 / 30, celZapasu: 22, dostepne: 3, otwarteZd: 0, otwarteZkBezRez: 1, doZamowienia: 20 },
      meta,
      2
    );
    expect(line.sprzedazOkres).toBe(5);
    expect(line.celZapasu).toBe(7);
    expect(line.doZamowienia).toBe(5);
    expect(line.salesProfile.kind).toBe("spike");
  });
});

describe("zdSalesProfileWindows", () => {
  it("12 okien po 30 dni, ostatnie kończy się w dniu końca", () => {
    const w = zdSalesProfileWindows("2026-10-02");
    expect(w).toHaveLength(12);
    expect(w[11]).toEqual({ dataOd: "2026-09-03", dataDo: "2026-10-02" });
    expect(w[10]!.dataDo).toBe("2026-09-02");
  });
});

describe("wiersz Kreatora z profilem", () => {
  // Stan 0, sprzedane 6 w 30 dniach — bez profilu ślad sprzedaży dokłada podbicie.
  const apiLine = {
    tw_Id: 1,
    tw_Symbol: "SAT01",
    tw_Nazwa: "x",
    dostepne: 0,
    sprzedazOkres: 6,
    sprzedazDziennie: 0.2,
    celZapasu: 6,
    otwarteZd: 0,
    otwarteZkBezRez: 0,
    doZamowienia: 6,
  };
  const opts = { dniZapasu: 30, dniOkresu: 30 };

  it("rzadka sprzedaż wygładzona: bez podbicia za wyprzedanie", () => {
    const plain = mapZdEstimateLineToManual(apiLine, opts);
    expect(plain.celZapasuTracked).toBeGreaterThan(plain.celZapasu);
    const meta = resolveZdSalesProfile({ windows: [0, 0, 0, 0, 0, 0, 0, 2, 1, 0, 0, 6], sprzedazOkres: 6, dniOkresu: 30, prosbaPieces: 0, smoothing: true });
    const line = applyZdSalesProfileToLine(apiLine, meta, 0);
    const smoothed = mapZdEstimateLineToManual(line, opts);
    expect(smoothed.salesProfile?.kind).toBe("rare");
    expect(smoothed.celZapasuTracked).toBeCloseTo(smoothed.celZapasu);
  });

  it("wygładzony skok pomija stary „skok sprzedaży” z historii ZD", () => {
    const history = { lastOrderedQty: 2, linkedAt: new Date(Date.now() - 20 * 86_400_000).toISOString() };
    const spikeLine = { ...apiLine, dostepne: 10, sprzedazOkres: 20, sprzedazDziennie: 20 / 30, celZapasu: 20 };
    const before = mapZdEstimateLineToManual(spikeLine, { ...opts, history });
    expect(before.salesTrackReasons).toContain("sales_spike");
    const meta = resolveZdSalesProfile({ windows: TP045, sprzedazOkres: 20, dniOkresu: 30, prosbaPieces: 0, smoothing: true });
    const after = mapZdEstimateLineToManual(applyZdSalesProfileToLine(spikeLine, meta, 0), { ...opts, history });
    expect(after.salesTrackReasons).not.toContain("sales_spike");
    expect(after.celZapasu).toBe(5);
  });

  it("przy wygładzeniu stary skok pomijany też dla regularnych (profil rozstrzyga)", () => {
    const history = { lastOrderedQty: 2, linkedAt: new Date(Date.now() - 20 * 86_400_000).toISOString() };
    const steadyLine = { ...apiLine, dostepne: 10, sprzedazOkres: 11, sprzedazDziennie: 11 / 30, celZapasu: 11 };
    const off = resolveZdSalesProfile({ windows: STEADY, sprzedazOkres: 11, dniOkresu: 30, prosbaPieces: 0, smoothing: false });
    const on = resolveZdSalesProfile({ windows: STEADY, sprzedazOkres: 11, dniOkresu: 30, prosbaPieces: 0, smoothing: true });
    expect(mapZdEstimateLineToManual(applyZdSalesProfileToLine(steadyLine, off, 0), { ...opts, history }).salesTrackReasons).toContain("sales_spike");
    expect(mapZdEstimateLineToManual(applyZdSalesProfileToLine(steadyLine, on, 0), { ...opts, history }).salesTrackReasons).not.toContain("sales_spike");
  });
});
