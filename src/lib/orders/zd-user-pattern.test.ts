import { describe, expect, it } from "vitest";
import { mapZdEstimateLineToManual } from "@/lib/orders/zd-estimate-manual";
import { applyUserPatternToManualLine, formatUserPattern } from "@/lib/orders/zd-user-pattern";

const line = () =>
  mapZdEstimateLineToManual(
    { tw_Id: 1117, tw_Symbol: "380-604-50", tw_Nazwa: "Lutowie", tw_Stan: 33, tw_StanRez: 0, dostepne: 33, celZapasu: 42, otwarteZd: 0, doZamowienia: 9 },
    { salesTrack: false, salesTrackCuts: false, zapasMin: 2 }
  );

describe("applyUserPatternToManualLine", () => {
  it("wzorzec „up” ×2: cel bez zapasMin podwojony, Do ZD przeliczone", () => {
    // Lutowie (21.10): silnik 6, ZD 15 — przy wzorcu 3 z 4 w górę cel 42 → 2 + 40 × 2 = 82, Do ZD 82 − 33 = 49.
    const out = applyUserPatternToManualLine(line(), { kind: "up", factor: 2, agree: 3, of: 4 }, { zapasMin: 2, otwarteZdPieces: 0 });
    expect(out.celZapasuTracked).toBe(82);
    expect(out.doZamowieniaReczne).toBe(49);
    expect(out.salesTrackDelta).toBe(40);
    expect(out.userPattern?.kind).toBe("up");
  });

  it("wzorzec „drop”: tylko znacznik, ilości bez zmian; otwarte ZD liczone w sztukach", () => {
    const base = line();
    const out = applyUserPatternToManualLine(base, { kind: "drop", factor: 0, agree: 3, of: 4 }, { zapasMin: 2, otwarteZdPieces: 0 });
    expect(out.doZamowieniaReczne).toBe(base.doZamowieniaReczne);
    expect(out.userPattern?.kind).toBe("drop");
    const down = applyUserPatternToManualLine(base, { kind: "down", factor: 0.5, agree: 3, of: 4 }, { zapasMin: 2, otwarteZdPieces: 10 });
    expect(down.celZapasuTracked).toBe(22);
    expect(down.doZamowieniaReczne).toBe(0);
  });

  it("zdanie wzorca po polsku", () => {
    expect(formatUserPattern({ kind: "up", factor: 1.8, agree: 3, of: 4 })).toBe("Podnosiłeś ilość 3 z 4 ostatnich razy — cel × 1,8.");
    expect(formatUserPattern({ kind: "drop", factor: 0, agree: 3, of: 3 })).toBe("Zdejmowałeś tę linię z ZD 3 z 3 ostatnich razy.");
  });
});
