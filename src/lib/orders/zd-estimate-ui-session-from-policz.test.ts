import { describe, expect, it } from "vitest";
import { buildZdEstimateUiSessionSnapshotFromPolicz } from "./zd-estimate-ui-session-from-policz";
import type { ManualZdEstimateLine, ManualZdEstimateResult } from "./zd-estimate-manual";
import { parseZdEstimateUiSessionSnapshot } from "./zd-estimate-ui-session-snapshot";

function line(partial?: Partial<ManualZdEstimateLine>): ManualZdEstimateLine {
  return {
    tw_Id: 1,
    tw_Symbol: "X",
    tw_Nazwa: "Test",
    tw_IdGrupa: null,
    grt_Nazwa: "",
    tw_Stan: 0,
    tw_StanRez: 0,
    dostepne: 0,
    sprzedazOkres: 10,
    wzNiepowiazaneOkres: 0,
    sprzedazDziennie: 0,
    celZapasu: 0,
    celZapasuTracked: 0,
    salesTrackDelta: 0,
    salesTrackReasons: [],
    salesTrackConfidence: 0,
    salesTrackQtyReview: false,
    salesTrackHeldExtraQty: 0,
    salesTrackAllowedExtraQty: 0,
    otwarteZkBezRez: 0,
    otwarteZkZarezerwowane: 0,
    otwarteZd: 0,
    doZamowieniaApi: 0,
    doZamowieniaReczne: 0,
    wkladZk: 0,
    ...partial,
  };
}

function emptyResult(
  lines: ManualZdEstimateLine[],
  base?: ManualZdEstimateLine[]
): ManualZdEstimateResult {
  return {
    parametry: {} as ManualZdEstimateResult["parametry"],
    pozycje: lines,
    pozycjeBase: base ?? lines,
    totalFromSubiekt: lines.length,
    doZamowieniaCount: 0,
    doZamowieniaSuma: 0,
  };
}

const meta = {
  pagesFetched: 8,
  totalCountApi: 1590,
  truncated: false,
  ordersBaseUrl: "http://orders.test",
  durationMs: 120_000,
  totalFromSubiekt: 1,
};

describe("buildZdEstimateUiSessionSnapshotFromPolicz", () => {
  it("porównanie strategii i czas dostawy przeżywają zapis i odczyt sesji", () => {
    const classicCompare = { byTwId: { 1: { units: 14, pieces: 14 } }, lineCount: 1, pieces: 14 };
    const snapshot = buildZdEstimateUiSessionSnapshotFromPolicz({
      mode: "cecha",
      grupaId: null,
      cechaId: 2717,
      scopeLabel: "Polkard",
      supplierId: "sup-1",
      dniZapasu: 25,
      dataOd: "2026-09-21",
      dataDo: "2026-10-20",
      zapasMin: 0,
      result: emptyResult([line()]),
      historyByTwId: [],
      historyFetchFailed: false,
      pendingIndividuals: [],
      pendingIndividualsTruncated: false,
      pendingIndividualsError: null,
      meta,
      boostPreset: "standard",
      leadDays: 2,
      classicCompare,
      seed: null,
    });
    const parsed = parseZdEstimateUiSessionSnapshot(JSON.parse(JSON.stringify(snapshot)));
    expect(parsed?.classicCompare).toEqual(classicCompare);
    expect(parsed?.leadDays).toBe(2);
  });

  it("buduje sesję cechy (Ivoclar) z mode/cechaId bez seeda UI", () => {
    const snapshot = buildZdEstimateUiSessionSnapshotFromPolicz({
      mode: "cecha",
      grupaId: null,
      cechaId: 2738,
      scopeLabel: "Ivoclar",
      supplierId: "sup-1",
      dniZapasu: 30,
      dataOd: "2026-01-01",
      dataDo: "2026-01-30",
      zapasMin: 0,
      result: emptyResult([line()]),
      historyByTwId: [],
      historyFetchFailed: false,
      pendingIndividuals: [],
      pendingIndividualsTruncated: false,
      pendingIndividualsError: null,
      meta,
      boostPreset: "standard",
      seed: null,
    });

    expect(snapshot.scopeMode).toBe("cecha");
    expect(snapshot.selectedCecha?.ctw_Id).toBe(2738);
    expect(snapshot.selectedCecha?.ctw_Nazwa).toBe("Ivoclar");
    expect(snapshot.selectedGroup).toBeNull();
    expect(snapshot.cechaQuery).toBe("Ivoclar");
    expect(snapshot.lines).toHaveLength(1);
    expect(snapshot.linesBase).toHaveLength(1);
    expect(snapshot.supplierId).toBe("sup-1");
    expect(parseZdEstimateUiSessionSnapshot(snapshot)).not.toBeNull();
  });

  it("preferuje seed UI (selectedCecha) nad syntetycznym zakresem", () => {
    const snapshot = buildZdEstimateUiSessionSnapshotFromPolicz({
      mode: "cecha",
      grupaId: null,
      cechaId: 2738,
      scopeLabel: "Ivoclar",
      supplierId: "sup-1",
      dniZapasu: 30,
      dataOd: "2026-01-01",
      dataDo: "2026-01-30",
      zapasMin: 0,
      result: emptyResult([line()]),
      historyByTwId: [{ twId: 1, lastOrderedQty: 2, linkedAt: "2026-01-01" }],
      historyFetchFailed: false,
      pendingIndividuals: null,
      pendingIndividualsTruncated: false,
      pendingIndividualsError: "boom",
      meta,
      boostPreset: "standard",
      seed: {
        selectedCecha: {
          ctw_Id: 2738,
          ctw_Nazwa: "Ivoclar",
          supplierId: "sup-1",
          supplierName: "Ivoclar Vivadent - EXCEL",
          dniZapasu: 45,
          stockLabel: "6 tyg.",
          subiektKhId: 100,
          additionalSubiektKhIds: [],
          supplierMatchSource: "mapping",
          supplierMappingUnresolved: false,
        },
        cechaQuery: "ivo",
        showAdvanced: true,
        sortKey: "symbol",
        sortDir: "asc",
      },
    });

    expect(snapshot.selectedCecha?.supplierName).toBe(
      "Ivoclar Vivadent - EXCEL"
    );
    expect(snapshot.selectedCecha?.dniZapasu).toBe(45);
    expect(snapshot.cechaQuery).toBe("ivo");
    expect(snapshot.showAdvanced).toBe(true);
    expect(snapshot.sortKey).toBe("symbol");
    expect(snapshot.pendingIndividualsError).toBe("boom");
    // Reguły z bazy nie trafiają do snapshotu — restore bierze świeże.
    expect(snapshot).not.toHaveProperty("teethTwIds");
    expect(parseZdEstimateUiSessionSnapshot(snapshot)).not.toBeNull();
  });

  it("buduje sesję grupy i czyści cecha", () => {
    const snapshot = buildZdEstimateUiSessionSnapshotFromPolicz({
      mode: "grupa",
      grupaId: 17,
      cechaId: null,
      scopeLabel: "Falcon",
      supplierId: "falcon",
      dniZapasu: 21,
      dataOd: "2026-01-01",
      dataDo: "2026-01-21",
      zapasMin: 1,
      result: emptyResult([line({ tw_Id: 2 })]),
      historyByTwId: [],
      historyFetchFailed: true,
      pendingIndividuals: [],
      pendingIndividualsTruncated: true,
      pendingIndividualsError: null,
      meta: { ...meta, totalFromSubiekt: 1 },
      boostPreset: "standard",
    });

    expect(snapshot.scopeMode).toBe("grupa");
    expect(snapshot.selectedGroup?.grt_Id).toBe(17);
    expect(snapshot.selectedCecha).toBeNull();
    expect(snapshot.groupQuery).toBe("Falcon");
    expect(snapshot.historyFetchFailed).toBe(true);
    expect(snapshot.pendingIndividualsTruncated).toBe(true);
    expect(snapshot.zapasMin).toBe("1");
    expect(parseZdEstimateUiSessionSnapshot(snapshot)).not.toBeNull();
  });

  it("coerce linesBase gdy base wygląda na zmergowane (pair/BOM)", () => {
    const merged = line({
      pair: {
        role: "pack",
        twinTwId: 2,
        unitsPerPack: 10,
        sprzedazSzt: 5,
        wzNiepowiazaneSzt: 0,
        coverSzt: 3,
        pieceSprzedaz: 0,
        packSprzedaz: 5,
        pieceWzNiepowiazane: 0,
        packWzNiepowiazane: 0,
        pieceDostepne: 0,
        packDostepne: 3,
      },
    });
    const snapshot = buildZdEstimateUiSessionSnapshotFromPolicz({
      mode: "cecha",
      grupaId: null,
      cechaId: 1,
      scopeLabel: "X",
      supplierId: null,
      dniZapasu: 30,
      dataOd: "2026-01-01",
      dataDo: "2026-01-30",
      zapasMin: 0,
      // Błędny kontrakt: base = linie zmergowane — coerce musi odzyskać kanał.
      result: emptyResult([merged], [merged]),
      historyByTwId: [],
      historyFetchFailed: false,
      pendingIndividuals: [],
      pendingIndividualsTruncated: false,
      pendingIndividualsError: null,
      meta,
      boostPreset: "standard",
    });

    expect(snapshot.linesBase[0]?.pair).toBeNull();
    expect(snapshot.linesBase[0]?.bom).toBeNull();
    expect(snapshot.linesBase[0]?.sprzedazOkres).toBe(5);
    expect(snapshot.lines[0]?.pair).not.toBeNull();
  });
});
