"use client";

import { useState } from "react";
import { ZdEstimateCreateZdDialog } from "@/components/zakupy/ZdEstimateCreateZdDialog";
import { ZdEstimatePostCreatePanel } from "@/components/zakupy/ZdEstimatePostCreatePanel";
import type { ZdSendSimulation } from "@/components/zakupy/ZdSendWorkspace";
import type { ZdCreatePreview, ZdCreatePreviewLine } from "@/lib/orders/zd-estimate-create-zd";
import type { ZdPostCreateKind, ZdPostCreateMarkFreeze, ZdPostCreateSession } from "@/lib/orders/zd-estimate-post-create";

type Scenario = "typical" | "simple" | "live" | "post_created" | "post_need_link" | "post_timeout";

const LINES: ZdCreatePreviewLine[] = [
  { twId: 101, symbol: "112-051-00", nazwa: "Lubrofilm płyn zmniejszający nap. powierz. 1000ml", ilosc: 6, packagingHint: null, piecesArriving: 6 },
  { twId: 102, symbol: "PK-2210", nazwa: "Polkard Wosk modelowy szary 70g", ilosc: 2, packagingHint: "op. 10 szt", unitsPerPackage: 10, documentUnitMode: "packages", piecesArriving: 20, individualExtraPieces: 4 },
  { twId: 103, symbol: "PK-0451", nazwa: "Polkard Gips twardy klasa IV żółty 25kg", ilosc: 3, packagingHint: null, piecesArriving: 3 },
  { twId: 104, symbol: "PK-7781", nazwa: "Polkard Izolator gips-akryl 500ml", ilosc: 4, packagingHint: null, piecesArriving: 4, roundupNeed: 3, roundupArrive: 4 },
  { twId: 105, symbol: "PK-1290", nazwa: "Polkard Masa osłaniająca do odlewów 6kg", ilosc: 1, packagingHint: null, piecesArriving: 1, bomOrPairLabel: "zestaw (składamy)" },
  { twId: 106, symbol: "PK-3305", nazwa: "Polkard Szczotka polerska kozia sierść średnia", ilosc: 12, packagingHint: null, piecesArriving: 12 },
];

const PRICES: Record<number, number> = { 101: 68.5, 102: 21.9, 103: 142, 104: 39.4, 106: 6.2 };

function preview(lines: ZdCreatePreviewLine[]): ZdCreatePreview {
  return {
    lines,
    lineCount: lines.length,
    zdUnitsSuma: lines.reduce((s, l) => s + l.ilosc, 0),
    piecesArrivingSuma: lines.reduce((s, l) => s + (l.piecesArriving ?? l.ilosc), 0),
    extraRequestLineCount: lines.filter((l) => (l.individualExtraPieces ?? 0) > 0).length,
    softWarnOverLimit: false,
  };
}

const MARK_FREEZE: ZdPostCreateMarkFreeze = {
  pendingGlowneCatalogIds: ["ord-1", "ord-2"],
  pendingGlowneServiceIds: [],
  consumedOrderIds: ["ord-1", "ord-2"],
  catalogRequests: [
    { orderId: "ord-1", salesPersonName: "Kasia J.", qty: 2, symbol: "PK-2210", products: "Polkard Wosk modelowy szary 70g", requestNote: "dla pracowni na Ochocie" },
    { orderId: "ord-2", salesPersonName: "Szymon R.", qty: 2, symbol: "PK-2210", products: "Polkard Wosk modelowy szary 70g", requestNote: null },
  ],
  serviceLines: [
    {
      key: "svc-1",
      label: "Naprawa artykulatora (wysyłka do serwisu)",
      qty: 1,
      reason: "no_subiekt",
      requests: [
        { orderId: "ord-3", salesPersonName: "Ola G.", qty: 1, symbol: null, products: "Naprawa artykulatora", requestNote: "klient czeka, priorytet" },
      ],
    },
  ],
  teethServiceCount: 0,
  omittedServiceCount: 0,
};

function postSession(
  supplierId: string,
  kind: ZdPostCreateKind,
  snapshotOk: boolean,
  real?: { dokId: number; supplierName: string }
): ZdPostCreateSession {
  return {
    kind,
    supplierId,
    supplierName: real?.supplierName ?? "Polkard",
    fromDaily: false,
    dokId: kind === "timeout_recovery" ? null : (real?.dokId ?? 1866820),
    dokNrPelny: kind === "timeout_recovery" ? null : real ? `ZD #${real.dokId}` : "ZD 29/M/10/2026",
    lineCount: LINES.length,
    snapshotOk,
    snapshotMessage: snapshotOk ? undefined : undefined,
    linesSnapshot: LINES.map((l) => ({
      twId: l.twId,
      symbol: l.symbol,
      nazwa: l.nazwa,
      plu: l.plu ?? null,
      ilosc: l.ilosc,
      packagingHint: l.packagingHint,
      individualExtraPieces: l.individualExtraPieces ?? 0,
      extraOnly: false,
      piecesArriving: l.piecesArriving ?? null,
      unitsPerPackage: l.unitsPerPackage ?? null,
      documentUnitMode: l.documentUnitMode ?? null,
      roundupNeed: l.roundupNeed ?? null,
      roundupArrive: l.roundupArrive ?? null,
      bomOrPairLabel: l.bomOrPairLabel ?? null,
      celAtLink: 0,
      deltaAtLink: 0,
    })),
    markFreeze: MARK_FREEZE,
    bumped: [{ twId: 102, from: 1, to: 2, extraPieces: 4 }],
    composedUwagi:
      "OnTime kreator · Cecha Polkard · 2026-10-03\nUsługi: Ola G. 1× Naprawa artykulatora (wysyłka do serwisu)",
    glowneDone: false,
    glowneMarkedIds: [],
    scheduleDone: false,
    linkNrPrefill: null,
    recentCandidateCount: kind === "timeout_recovery" ? 1 : undefined,
    createdAtMs: Date.now(),
  };
}

/** Harness: okno podsumowania „Utwórz ZD” — `previewOnly`, więc nic nie trafia do Subiekta. */
/** `real` — prawdziwe ZD i dostawca (`?dok=…&nazwa=…`): okno wysyłki z podglądem i prawdziwym załącznikiem, bez wysyłania. */
export function ZdCreateDialogLab({
  supplierId,
  real,
}: {
  supplierId: string;
  real?: { dokId: number; supplierName: string };
}) {
  const [simulation, setSimulation] = useState<ZdSendSimulation>("ok");
  const [scenario, setScenario] = useState<Scenario | null>("typical");
  const typical = scenario === "typical";
  const lines = scenario === "simple" ? LINES.slice(0, 2) : LINES;

  return (
    <main className="mx-auto max-w-3xl space-y-4 p-6" data-testid="e2e-lab-zd-create">
      <h1 className="text-lg font-semibold text-slate-900">Podgląd: okno „Utwórz ZD”</h1>
      <p className="text-sm text-slate-600">
        Dane przykładowe. Przycisk tworzenia w tym podglądzie nic nie wysyła. Termin dostawy:{" "}
        <code>?dostawca=&lt;id karty dostawcy&gt;</code>.
      </p>
      <div className="flex flex-wrap gap-2">
        {(["typical", "simple", "live", "post_created", "post_need_link", "post_timeout"] as const).map((s) => (
          <button
            key={s}
            type="button"
            className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-sm hover:bg-slate-50"
            onClick={() => setScenario(s)}
          >
            {
              {
                typical: "Typowe (ostrzeżenia, prośby)",
                simple: "Proste",
                live: "Aktualna baza",
                post_created: "Po utworzeniu",
                post_need_link: "Po utworzeniu: historia do powiązania",
                post_timeout: "Po utworzeniu: przekroczony czas",
              }[s]
            }
          </button>
        ))}
      </div>
      {scenario?.startsWith("post_") ? (
        <label className="flex items-center gap-2 text-sm text-slate-700">
          Symulacja wysyłki:
          <select
            value={simulation}
            onChange={(e) => setSimulation(e.target.value as ZdSendSimulation)}
            className="rounded-md border border-slate-200 bg-white px-2 py-1"
          >
            <option value="ok">wszystko się udaje</option>
            <option value="termin_error">błąd zapisu terminu (potem ponów)</option>
          </select>
        </label>
      ) : null}
      {scenario?.startsWith("post_") ? (
        <ZdEstimatePostCreatePanel
          key={`${scenario}-${simulation}`}
          previewOnly
          sendSimulation={simulation}
          session={postSession(
            supplierId,
            scenario === "post_timeout" ? "timeout_recovery" : "created",
            scenario !== "post_need_link",
            real
          )}
          onDismiss={() => setScenario(null)}
          onOpenLink={() => undefined}
        />
      ) : scenario ? (
        <ZdEstimateCreateZdDialog
          key={scenario}
          open
          previewOnly
          supplierId={supplierId}
          supplierName="Polkard"
          khId={2110}
          usedAlias={typical}
          scopeLabel="Polkard"
          dateKey="2026-10-03"
          preview={preview(lines)}
          scopeMode="cecha"
          unitPriceByTwId={PRICES}
          calcNotes={["sprzedaż 90 dni", "zapas 3 tyg.", "z prośbami"]}
          cechaId={41}
          initialUwagi="OnTime kreator · Cecha Polkard · 2026-10-03"
          markFreeze={typical ? MARK_FREEZE : null}
          serviceLinesForCompose={
            typical
              ? MARK_FREEZE.serviceLines.map((l) => ({
                  ...l,
                  requests: l.requests.map((r) => ({
                    ...r,
                    salesPersonId: "sp",
                    mikranCode: null,
                  })),
                }))
              : []
          }
          listAgeMinutes={typical ? 47 : 2}
          manualOverrideCount={typical ? 2 : 0}
          pendingReviewCount={typical ? 1 : 0}
          onRecountRequest={() => undefined}
          onClose={() => setScenario(null)}
          onCreated={() => undefined}
          onError={() => undefined}
          ordersIsLive={scenario === "live"}
          ordersPort={scenario === "live" ? 5080 : 5082}
          ordersHostLabel="192.168.0.140"
        />
      ) : null}
    </main>
  );
}
