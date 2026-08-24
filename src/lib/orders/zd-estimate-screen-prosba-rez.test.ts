/**
 * Regresja scenariusza ze screena Kreatora ZD (Renfert / Z PROŚBY).
 */
import { describe, expect, it } from "vitest";
import {
  buildZdCreatePreviewFromOrderable,
  canCreateZdFromEstimateState,
} from "./zd-estimate-create-zd";
import {
  filterOrderableLinesWithPackaging,
  resolveOrderQtyForLine,
} from "./zd-estimate-packaging";
import {
  individualExtrasAndReliefWithReservationOverlap,
  resolveProsbaReservationDedupeMaps,
} from "./zd-estimate-prosba-reservation-overlap";
import type { ManualZdEstimateLine } from "./zd-estimate-manual";

function renfertLine(): ManualZdEstimateLine {
  return {
    tw_Id: 65000550,
    tw_Symbol: "65000550",
    tw_Nazwa: "Renfert-Cleaning pins",
    tw_IdGrupa: null,
    grt_Nazwa: "—",
    tw_Stan: 0,
    tw_StanRez: 3,
    dostepne: -3,
    sprzedazOkres: 0,
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
    otwarteZkZarezerwowane: 3,
    otwarteZd: 0,
    doZamowieniaApi: 0,
    doZamowieniaReczne: 0,
    wkladZk: 0,
  } as ManualZdEstimateLine;
}

describe("Screen regresja: Z PROŚBY + rez. 3 + Do ZD", () => {
  const byTw = new Map([
    [
      65000550,
      {
        extraPieces: 3,
        overlapContributions: [
          {
            orderId: "prosba-1",
            qty: 3,
            salesClientKhId: 100,
            sourceZkNumber: null as string | null,
          },
        ],
      },
    ],
  ]);
  const reserved = new Map([
    [
      65000550,
      [{ quantity: 3, clientKhId: 100, zkNumber: "ZK 12/M/08/2026" }],
    ],
  ]);

  it("Workbench path: raw+overlap+extraOnly → Do ZD 3 (nie 0)", () => {
    const maps = resolveProsbaReservationDedupeMaps(byTw, reserved);
    expect(maps.extraByTwId.get(65000550)).toBe(3);
    expect(maps.extraOverlapByTwId.get(65000550)).toBe(3);

    const line = renfertLine();
    const pack = new Map([
      [65000550, { unitsPerPackage: 1, packageLabel: "szt" }],
    ]);
    const extraOnly = new Set([65000550]);

    const zd = resolveOrderQtyForLine(
      line,
      pack.get(65000550),
      maps.extraByTwId.get(65000550),
      true,
      "sum",
      maps.stockNeedReliefByTwId.get(65000550) ?? 0,
      maps.extraOverlapByTwId.get(65000550) ?? 0
    ).zdUnits;
    expect(zd).toBe(3);

    const orderable = filterOrderableLinesWithPackaging(
      [line],
      pack,
      new Set(),
      maps.extraByTwId,
      null,
      extraOnly,
      "sum",
      maps.extraByTwId,
      maps.stockNeedReliefByTwId,
      maps.extraOverlapByTwId
    );
    expect(orderable).toHaveLength(1);

    const preview = buildZdCreatePreviewFromOrderable(
      orderable,
      pack,
      maps.extraByTwId,
      null,
      extraOnly,
      "sum",
      maps.stockNeedReliefByTwId,
      maps.extraOverlapByTwId
    );
    expect(preview.lineCount).toBe(1);
    expect(preview.lines[0]?.ilosc).toBe(3);
  });

  it("z source_zk własnego ZK też Do ZD 3", () => {
    const withSource = new Map([
      [
        65000550,
        {
          extraPieces: 3,
          overlapContributions: [
            {
              orderId: "prosba-1",
              qty: 3,
              salesClientKhId: 100,
              sourceZkNumber: "ZK 12/M/08/2026",
            },
          ],
        },
      ],
    ]);
    const maps = individualExtrasAndReliefWithReservationOverlap(
      withSource,
      reserved
    );
    expect(maps.extraOverlapByTwId.has(65000550)).toBe(false);
    expect(maps.stockNeedReliefByTwId.get(65000550)).toBe(3);
    expect(
      resolveOrderQtyForLine(
        renfertLine(),
        { unitsPerPackage: 1, packageLabel: "szt" },
        3,
        true,
        "sum",
        3,
        0
      ).zdUnits
    ).toBe(3);
  });

  it("klasyczny 1+1 (stock, bez source_zk) → Do ZD 1, nie 2", () => {
    const line = {
      ...renfertLine(),
      tw_Stan: 5,
      tw_StanRez: 1,
      dostepne: 4,
      celZapasu: 5,
      celZapasuTracked: 5,
    };
    const maps = individualExtrasAndReliefWithReservationOverlap(
      new Map([
        [
          65000550,
          {
            extraPieces: 1,
            overlapContributions: [
              {
                orderId: "o",
                qty: 1,
                salesClientKhId: 100,
                sourceZkNumber: null,
              },
            ],
          },
        ],
      ]),
      new Map([
        [65000550, [{ quantity: 1, clientKhId: 100, zkNumber: "ZK 1" }]],
      ])
    );
    expect(
      resolveOrderQtyForLine(
        line,
        { unitsPerPackage: 1, packageLabel: "szt" },
        maps.extraByTwId.get(65000550),
        false,
        "sum",
        0,
        maps.extraOverlapByTwId.get(65000550) ?? 0
      ).zdUnits
    ).toBe(1);
  });

  it("nadpisanie Do ZD=0 (Zeruj) nadal blokuje — to nie bug overlap", () => {
    const gate = canCreateZdFromEstimateState({
      configured: true,
      settingsTrusted: true,
      orderableCount: 0,
      supplierId: "s1",
      khResolution: {
        ok: true,
        khId: 1,
        usedAlias: false,
        supplierName: "A",
      },
      estimating: false,
      mutating: false,
      creating: false,
      createDoneDokId: null,
    });
    expect(gate.ok).toBe(false);
  });
});
