"use client";

import { useMemo } from "react";
import {
  buildIndividualEstimateExtras,
  composeZdCreateUwagiWithServices,
  countExcludedWithIndividualRequests,
  reclassifyExcludedTwExtrasToServices,
} from "@/lib/orders/zd-estimate-individual";
import { ensureZdCreateLinesCoverIndividualExtras } from "@/lib/orders/zd-estimate-create-zd";
import { resolveOrderQtyForLine } from "@/lib/orders/zd-estimate-packaging";
import type { ManualZdEstimateLine } from "@/lib/orders/zd-estimate-manual";

/**
 * Harness kontraktów prośb w szacunku ZD — bez auth / Subiekta.
 * Playwright sprawdza data-testid wyników pure-logic.
 */
export function E2ELabZdEstimateIndividualsSection() {
  const report = useMemo(() => {
    const soloLine = {
      tw_Id: 1,
      tw_Symbol: "SOLO",
      tw_Nazwa: "Solo",
      tw_IdGrupa: null,
      grt_Nazwa: "—",
      tw_Stan: 0,
      tw_StanRez: 0,
      dostepne: 0,
      sprzedazOkres: 0,
      sprzedazDziennie: 0,
      celZapasu: 0,
      celZapasuTracked: 0,
      salesTrackDelta: 0,
      salesTrackReasons: [],
      otwarteZkBezRez: 0,
      otwarteZkZarezerwowane: 0,
      otwarteZd: 0,
      doZamowieniaApi: 0,
      doZamowieniaReczne: 0,
      wkladZk: 0,
      pair: null,
      bom: null,
    } as ManualZdEstimateLine;

    const packQty = resolveOrderQtyForLine(
      {
        ...soloLine,
        tw_Id: 10,
        doZamowieniaReczne: 0,
        pair: {
          role: "pack",
          twinTwId: 20,
          unitsPerPack: 10,
          sprzedazSzt: 0,
          coverSzt: 0,
          pieceSprzedaz: 0,
          packSprzedaz: 0,
          pieceDostepne: 0,
          packDostepne: 0,
          partnerMissing: true,
        },
      },
      { unitsPerPackage: 10, packageLabel: "op." },
      15
    );

    const extras = buildIndividualEstimateExtras({
      orders: [
        {
          id: "a",
          salesPersonId: "s",
          salesPersonName: "Anna",
          products: "P",
          symbol: "S",
          mikranCode: null,
          subiektTwId: 1,
          qty: 2,
          requestNote: null,
        },
        {
          id: "b",
          salesPersonId: "s",
          salesPersonName: "Bartek",
          products: "P2",
          symbol: "S2",
          mikranCode: null,
          subiektTwId: 1,
          qty: 3,
          requestNote: null,
        },
      ],
      lines: [{ tw_Id: 1, tw_Symbol: "S" }],
    });
    const excludedCount = countExcludedWithIndividualRequests(
      extras.byTwId,
      [1]
    );
    const routed = reclassifyExcludedTwExtrasToServices(extras, [1]);

    const longBase = "X".repeat(480);
    const serviceLine = {
      key: "s1",
      label: "Usługa jednorazowa: W",
      qty: 1,
      reason: "no_subiekt" as const,
      requests: [
        {
          orderId: "ox",
          salesPersonId: "s",
          salesPersonName: "Anna",
          qty: 1,
          products: "p",
          symbol: "W",
          mikranCode: null,
          requestNote: null,
        },
      ],
    };
    const composed = composeZdCreateUwagiWithServices({
      baseUwagi: longBase,
      serviceLines: [serviceLine],
      maxLen: 500,
      prioritizeServices: true,
    });

    const cover = ensureZdCreateLinesCoverIndividualExtras({
      lines: [{ twId: 10, ilosc: 1 }],
      extraPiecesByTwId: new Map([[10, 15]]),
      unitsPerPackageByTwId: new Map([[10, 10]]),
    });

    const checks = {
      partnerMissingExtraZdUnits: packQty.zdUnits === 2,
      excludedOrderCount: excludedCount === 2,
      excludedRoutedToServices:
        routed.serviceLines.filter((l) => l.reason === "excluded").length === 2,
      prioritizeServicesKeepsOx: composed.includedServiceOrderIds.includes("ox"),
      coverExtrasBumpsTo2: cover.lines[0]?.ilosc === 2,
    };
    const ok = Object.values(checks).every(Boolean);
    return { ok, checks };
  }, []);

  return (
    <section className="space-y-2 rounded-md border border-slate-200 p-3">
      <h2 className="text-sm font-semibold text-slate-900">
        ZD estimate — prośby (kontrakty)
      </h2>
      <p data-testid="zd-individuals-ok" className="text-sm text-slate-800">
        {report.ok ? "pass" : "fail"}
      </p>
      <pre
        data-testid="zd-individuals-checks"
        className="overflow-auto rounded bg-slate-50 p-2 text-[11px] text-slate-700"
      >
        {JSON.stringify(report.checks, null, 2)}
      </pre>
    </section>
  );
}
