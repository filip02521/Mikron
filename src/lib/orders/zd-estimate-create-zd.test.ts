import { describe, expect, it } from "vitest";
import {
  applyCreatedZdUnitsToOtwarteZd,
  buildZdCreateApiBody,
  buildZdCreatePreviewFromOrderable,
  canCreateZdFromEstimateState,
  defaultZdCreateUwagi,
  ensureZdCreateLinesCoverIndividualExtras,
  normalizeZdCreateUwagi,
  resolveZdCreateKhId,
  validateZdCreateClientLines,
  ZD_CREATE_MAX_LINES,
  ZD_CREATE_MAX_QTY,
} from "@/lib/orders/zd-estimate-create-zd";
import type { ManualZdEstimateLine } from "@/lib/orders/zd-estimate-manual";
import { buildZdEstimateSnapshotLinesFromDoc } from "@/lib/orders/zd-estimate-snapshot-lines";

function baseLine(
  overrides: Partial<ManualZdEstimateLine> & { tw_Id: number }
): ManualZdEstimateLine {
  return {
    tw_Symbol: `S${overrides.tw_Id}`,
    tw_Nazwa: `N${overrides.tw_Id}`,
    tw_IdGrupa: 1,
    grt_Nazwa: "G",
    tw_Stan: 0,
    tw_StanRez: 0,
    dostepne: 0,
    sprzedazOkres: 10,
    sprzedazDziennie: 1,
    celZapasu: 10,
    celZapasuTracked: 10,
    salesTrackDelta: 0,
    salesTrackReasons: [],
    salesTrackConfidence: 0,
    salesTrackQtyReview: false,
    salesTrackHeldExtraQty: 0,
    salesTrackAllowedExtraQty: 0,
    otwarteZkBezRez: 0,
    otwarteZkZarezerwowane: 0,
    otwarteZd: 0,
    doZamowieniaApi: 10,
    doZamowieniaReczne: 10,
    wkladZk: 0,
    pair: null,
    bom: null,
    ...overrides,
  };
}

describe("resolveZdCreateKhId", () => {
  it("używa primary", () => {
    const r = resolveZdCreateKhId({
      supplierName: "Acme",
      primaryKhId: 42,
      additionalKhIds: [99],
    });
    expect(r).toEqual({
      ok: true,
      khId: 42,
      usedAlias: false,
      supplierName: "Acme",
    });
  });

  it("używa dokładnie jednego aliasu", () => {
    const r = resolveZdCreateKhId({
      supplierName: "Acme",
      primaryKhId: null,
      additionalKhIds: [88],
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.khId).toBe(88);
      expect(r.usedAlias).toBe(true);
    }
  });

  it("odrzuca wiele aliasów bez primary", () => {
    const r = resolveZdCreateKhId({
      supplierName: "Acme",
      primaryKhId: null,
      additionalKhIds: [1, 2],
    });
    expect(r.ok).toBe(false);
  });

  it("odrzuca brak kh", () => {
    const r = resolveZdCreateKhId({
      supplierName: "Acme",
      primaryKhId: null,
      additionalKhIds: [],
    });
    expect(r.ok).toBe(false);
  });
});

describe("buildZdCreatePreviewFromOrderable", () => {
  it("Castorit: piece i parent BOM poza preview", () => {
    const lines = [
      baseLine({
        tw_Id: 1,
        tw_Symbol: "PLYN",
        celZapasu: 7,
        celZapasuTracked: 7,
        doZamowieniaReczne: 7,
      }),
      baseLine({
        tw_Id: 2,
        tw_Symbol: "MASA",
        doZamowieniaReczne: 40,
        pair: {
          role: "piece",
          twinTwId: 3,
          unitsPerPack: 40,
          sprzedazSzt: 0,
          coverSzt: 0,
          pieceSprzedaz: 0,
          packSprzedaz: 0,
          pieceDostepne: 0,
          packDostepne: 0,
          partnerMissing: false,
        },
      }),
      baseLine({
        tw_Id: 3,
        tw_Symbol: "KARTON",
        doZamowieniaReczne: 80,
        pair: {
          role: "pack",
          twinTwId: 2,
          unitsPerPack: 40,
          sprzedazSzt: 0,
          coverSzt: 0,
          pieceSprzedaz: 0,
          packSprzedaz: 0,
          pieceDostepne: 0,
          packDostepne: 0,
          partnerMissing: false,
        },
      }),
      baseLine({
        tw_Id: 4,
        tw_Symbol: "PROMO",
        doZamowieniaReczne: 5,
        bom: {
          role: "assembled_parent",
          parentTwIds: [4],
        },
      }),
    ];
    const pack = new Map([[3, { unitsPerPackage: 40, packageLabel: "op." }]]);
    const preview = buildZdCreatePreviewFromOrderable(lines, pack);
    const symbols = preview.lines.map((l) => l.symbol).sort();
    expect(symbols).toEqual(["KARTON", "PLYN"]);
    const karton = preview.lines.find((l) => l.symbol === "KARTON");
    expect(karton?.ilosc).toBe(2); // ceil(80/40)
    expect(preview.lines.find((l) => l.symbol === "PLYN")?.ilosc).toBe(7);
  });

  it("purchased_kit wchodzi do preview Create", () => {
    const lines = [
      baseLine({
        tw_Id: 10,
        tw_Symbol: "A",
        celZapasu: 60,
        celZapasuTracked: 60,
        doZamowieniaReczne: 60,
      }),
      baseLine({
        tw_Id: 30,
        tw_Symbol: "K",
        celZapasu: 20,
        celZapasuTracked: 20,
        doZamowieniaReczne: 20,
        bom: {
          role: "purchased_kit",
          purchaseTarget: "as_sold",
        },
      }),
    ];
    const preview = buildZdCreatePreviewFromOrderable(lines, new Map());
    expect(preview.lines.map((l) => l.symbol).sort()).toEqual(["A", "K"]);
    expect(preview.lines.find((l) => l.symbol === "K")?.ilosc).toBe(20);
  });

  it("respektuje override jednostek dokumentu", () => {
    const lines = [
      baseLine({
        tw_Id: 1,
        tw_Symbol: "PLYN",
        celZapasu: 7,
        celZapasuTracked: 7,
        doZamowieniaReczne: 7,
      }),
      baseLine({
        tw_Id: 3,
        tw_Symbol: "KARTON",
        doZamowieniaReczne: 80,
        pair: {
          role: "pack",
          twinTwId: 2,
          unitsPerPack: 40,
          sprzedazSzt: 0,
          coverSzt: 0,
          pieceSprzedaz: 0,
          packSprzedaz: 0,
          pieceDostepne: 0,
          packDostepne: 0,
          partnerMissing: false,
        },
      }),
    ];
    const pack = new Map([[3, { unitsPerPackage: 40, packageLabel: "op." }]]);
    const overrides = new Map([
      [1, 0],
      [3, 5],
    ]);
    const preview = buildZdCreatePreviewFromOrderable(
      lines,
      pack,
      null,
      overrides
    );
    expect(preview.lines.map((l) => l.symbol).sort()).toEqual(["KARTON"]);
    expect(preview.lines[0]?.ilosc).toBe(5);
    expect(preview.lineCount).toBe(1);
  });

  it("extra_only: Create qty = ceil(prośba), bez stocku z doZamowieniaReczne", () => {
    const lines = [
      baseLine({
        tw_Id: 3,
        tw_Symbol: "KARTON",
        doZamowieniaReczne: 500,
        pair: {
          role: "pack",
          twinTwId: 2,
          unitsPerPack: 40,
          sprzedazSzt: 0,
          coverSzt: 0,
          pieceSprzedaz: 0,
          packSprzedaz: 0,
          pieceDostepne: 0,
          packDostepne: 0,
          partnerMissing: false,
        },
      }),
    ];
    const pack = new Map([[3, { unitsPerPackage: 40, packageLabel: "op." }]]);
    const extras = new Map([[3, 25]]);
    const preview = buildZdCreatePreviewFromOrderable(
      lines,
      pack,
      extras,
      null,
      new Set([3])
    );
    expect(preview.lines).toHaveLength(1);
    expect(preview.lines[0]?.ilosc).toBe(1); // ceil(25/40)
    expect(preview.lines[0]?.individualExtraPieces).toBe(25);
  });
});

describe("validateZdCreateClientLines", () => {
  it("limity i dedupe", () => {
    expect(validateZdCreateClientLines([]).ok).toBe(false);
    expect(
      validateZdCreateClientLines([{ twId: 1, ilosc: 0 }]).ok
    ).toBe(false);
    expect(
      validateZdCreateClientLines([
        { twId: 1, ilosc: 1 },
        { twId: 1, ilosc: 2 },
      ]).ok
    ).toBe(false);
    expect(
      validateZdCreateClientLines([
        { twId: 1, ilosc: ZD_CREATE_MAX_QTY + 1 },
      ]).ok
    ).toBe(false);
    const many = Array.from({ length: ZD_CREATE_MAX_LINES + 1 }, (_, i) => ({
      twId: i + 1,
      ilosc: 1,
    }));
    expect(validateZdCreateClientLines(many).ok).toBe(false);
    expect(
      validateZdCreateClientLines([{ twId: 1, ilosc: 2.5 }]).ok
    ).toBe(true);
  });
});

describe("buildZdCreateApiBody + uwagi", () => {
  it("buduje body i przycina uwagi", () => {
    const body = buildZdCreateApiBody({
      kontrahentId: 10,
      uwagi: `  ${"x".repeat(600)}  `,
      lines: [{ twId: 1, ilosc: 3 }],
    });
    expect(body.kontrahentId).toBe(10);
    expect(body.uwagi?.length).toBe(500);
    expect(body.pozycje).toEqual([{ towarId: 1, ilosc: 3 }]);
    expect(normalizeZdCreateUwagi("  ")).toBeNull();
    expect(
      defaultZdCreateUwagi({
        supplierName: "A",
        scopeLabel: "G",
        dateKey: "2026-08-08",
      })
    ).toBe("OnTime kreator · A · G · 2026-08-08");
  });
});

describe("canCreateZdFromEstimateState", () => {
  const khOk = {
    ok: true as const,
    khId: 1,
    usedAlias: false,
    supplierName: "A",
  };

  it("wymaga configured, settings, supplier, kh, orderable", () => {
    expect(
      canCreateZdFromEstimateState({
        configured: true,
        settingsTrusted: true,
        orderableCount: 1,
        supplierId: "s1",
        khResolution: khOk,
        estimating: false,
        mutating: false,
        creating: false,
        createDoneDokId: null,
      }).ok
    ).toBe(true);

    expect(
      canCreateZdFromEstimateState({
        configured: true,
        settingsTrusted: true,
        orderableCount: 1,
        supplierId: "s1",
        khResolution: khOk,
        estimating: false,
        mutating: false,
        creating: false,
        createDoneDokId: null,
        boostNeedsRecount: true,
      }).ok
    ).toBe(false);

    expect(
      canCreateZdFromEstimateState({
        configured: true,
        settingsTrusted: true,
        orderableCount: 1,
        supplierId: null,
        khResolution: khOk,
        estimating: false,
        mutating: false,
        creating: false,
        createDoneDokId: null,
      }).ok
    ).toBe(false);

    expect(
      canCreateZdFromEstimateState({
        configured: true,
        settingsTrusted: true,
        orderableCount: 1,
        supplierId: "s1",
        khResolution: khOk,
        estimating: false,
        mutating: false,
        creating: false,
        createDoneDokId: 99,
      }).ok
    ).toBe(false);

    expect(
      canCreateZdFromEstimateState({
        configured: true,
        settingsTrusted: true,
        orderableCount: 1,
        supplierId: "s1",
        khResolution: khOk,
        estimating: false,
        mutating: false,
        creating: false,
        createDoneDokId: 99,
        createUnlockedAfterDone: true,
      }).ok
    ).toBe(true);

    expect(
      canCreateZdFromEstimateState({
        configured: true,
        settingsTrusted: true,
        orderableCount: 1,
        supplierId: "s1",
        khResolution: khOk,
        estimating: false,
        mutating: false,
        creating: false,
        createDoneDokId: null,
        createUnconfirmedAttempt: true,
      }).ok
    ).toBe(false);

    expect(
      canCreateZdFromEstimateState({
        configured: true,
        settingsTrusted: true,
        orderableCount: 1,
        supplierId: "s1",
        khResolution: khOk,
        estimating: false,
        mutating: false,
        creating: false,
        createDoneDokId: null,
        createUnconfirmedAttempt: true,
        createUnlockedAfterDone: true,
      }).ok
    ).toBe(true);

    expect(
      canCreateZdFromEstimateState({
        configured: true,
        settingsTrusted: true,
        orderableCount: 1,
        supplierId: "s1",
        khResolution: khOk,
        estimating: false,
        mutating: false,
        creating: false,
        createDoneDokId: null,
        packagingPairConflictCount: 2,
      }).ok
    ).toBe(false);

    expect(
      canCreateZdFromEstimateState({
        configured: true,
        settingsTrusted: true,
        orderableCount: 1,
        supplierId: "s1",
        khResolution: khOk,
        estimating: false,
        mutating: false,
        creating: false,
        createDoneDokId: null,
        explodeBomIncomplete: true,
      })
    ).toEqual({
      ok: false,
      reason: expect.stringMatching(/Skład|niekompletny|dociągnij/i),
    });
  });
});

describe("ensureZdCreateLinesCoverIndividualExtras", () => {
  it("podbija ilosc gdy extras > wysłane (ceil opakowania)", () => {
    const res = ensureZdCreateLinesCoverIndividualExtras({
      lines: [{ twId: 10, ilosc: 1, symbol: "P" }],
      extraPiecesByTwId: new Map([[10, 15]]),
      unitsPerPackageByTwId: new Map([[10, 10]]),
    });
    expect(res.lines[0]?.ilosc).toBe(2);
    expect(res.bumped).toEqual([
      { twId: 10, from: 1, to: 2, extraPieces: 15 },
    ]);
  });

  it("nie obniża qty klienta", () => {
    const res = ensureZdCreateLinesCoverIndividualExtras({
      lines: [{ twId: 10, ilosc: 5 }],
      extraPiecesByTwId: new Map([[10, 8]]),
      unitsPerPackageByTwId: new Map([[10, 10]]),
    });
    expect(res.lines[0]?.ilosc).toBe(5);
    expect(res.bumped).toEqual([]);
  });

  it("Mode B: 15 szt / N=10 → minZd 20 (sztuki), nie 2 paczki", () => {
    const res = ensureZdCreateLinesCoverIndividualExtras({
      lines: [{ twId: 10, ilosc: 1, symbol: "P" }],
      extraPiecesByTwId: new Map([[10, 15]]),
      unitsPerPackageByTwId: new Map([[10, 10]]),
      packagingModeByTwId: new Map([[10, "pieces_multiple"]]),
    });
    expect(res.lines[0]?.ilosc).toBe(20);
    expect(res.bumped).toEqual([
      { twId: 10, from: 1, to: 20, extraPieces: 15 },
    ]);
  });
});

describe("applyCreatedZdUnitsToOtwarteZd", () => {
  it("podbija otwarteZd", () => {
    const lines = [baseLine({ tw_Id: 1, otwarteZd: 2 })];
    const next = applyCreatedZdUnitsToOtwarteZd(lines, new Map([[1, 5]]));
    expect(next[0]?.otwarteZd).toBe(7);
  });

  it("Mode B: otwarteZd w sztukach — bez × N przy przeliczeniu doZamowienia", () => {
    const lines = [
      baseLine({
        tw_Id: 1,
        otwarteZd: 0,
        celZapasu: 20,
        celZapasuTracked: 20,
        dostepne: 0,
        doZamowieniaReczne: 20,
      }),
    ];
    const pack = new Map([
      [
        1,
        {
          unitsPerPackage: 5,
          documentUnitMode: "pieces_multiple" as const,
        },
      ],
    ]);
    // Create wysłał 10 szt (Mode B) — otwarte +10, cover pieces = 10 (nie 50)
    const next = applyCreatedZdUnitsToOtwarteZd(
      lines,
      new Map([[1, 10]]),
      pack
    );
    expect(next[0]?.otwarteZd).toBe(10);
    expect(next[0]?.doZamowieniaReczne).toBe(10);
  });

  it("czyści salesTrackQtyReview na bumped", () => {
    const lines = [
      baseLine({
        tw_Id: 1,
        otwarteZd: 0,
        celZapasuTracked: 10,
        doZamowieniaReczne: 10,
        salesTrackQtyReview: true,
        salesTrackHeldExtraQty: 1,
        salesTrackAllowedExtraQty: 0,
        salesTrackReasons: ["thin_cover", "boost_held"],
      }),
    ];
    const next = applyCreatedZdUnitsToOtwarteZd(lines, new Map([[1, 10]]));
    expect(next[0]?.salesTrackQtyReview).toBe(false);
    expect(next[0]?.salesTrackHeldExtraQty).toBe(0);
    expect(next[0]?.salesTrackReasons).toEqual(["thin_cover"]);
  });
});

describe("buildZdEstimateSnapshotLinesFromDoc", () => {
  it("mnoży paczki do sztuk", () => {
    const lines = buildZdEstimateSnapshotLinesFromDoc(
      {
        dok_Id: 1,
        dok_Pozycja: [
          { ob_TowId: 10, ob_Ilosc: 2, tw_Symbol: "K", tw_Nazwa: "Karton" },
        ],
      },
      {
        packagingByTwId: new Map([[10, 40]]),
        lineMeta: [{ twId: 10, celAtLink: 100, deltaAtLink: -1 }],
      }
    );
    expect(lines).toEqual([
      {
        twId: 10,
        twSymbol: "K",
        twNazwa: "Karton",
        qty: 80,
        celAtLink: 100,
        deltaAtLink: -1,
        ratioAtLink: null,
      },
    ]);
  });

  it("Mode B: qty snapshot = sztuki z dokumentu (ratio 1)", () => {
    const lines = buildZdEstimateSnapshotLinesFromDoc(
      {
        dok_Id: 1,
        dok_Pozycja: [
          { ob_TowId: 10, ob_Ilosc: 10, tw_Symbol: "K", tw_Nazwa: "Karton" },
        ],
      },
      {
        packagingByTwId: new Map([[10, 5]]),
        packagingModeByTwId: new Map([[10, "pieces_multiple"]]),
        lineMeta: [{ twId: 10, celAtLink: 100, deltaAtLink: -1 }],
      }
    );
    expect(lines).toEqual([
      {
        twId: 10,
        twSymbol: "K",
        twNazwa: "Karton",
        qty: 10,
        celAtLink: 100,
        deltaAtLink: -1,
        ratioAtLink: 1,
      },
    ]);
  });
});
