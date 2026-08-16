"use client";

import { useEffect, useId, useMemo, useState, useTransition } from "react";
import { actionCreateZdFromEstimate } from "@/app/actions/zd-estimate";
import type { ZdEstimateLinkLineMeta } from "@/app/actions/zd-estimate";
import { ZdEstimateCreateZdProgressPanel } from "@/components/zakupy/ZdEstimateCreateZdProgress";
import { ZdEstimateCreateRequestsPreview } from "@/components/zakupy/ZdEstimateCreateRequestsPreview";
import { ZdEstimateOrderPreviewTable } from "@/components/zakupy/ZdEstimateOrderPreviewTable";
import { Button } from "@/components/ui/Button";
import { ModalShell } from "@/components/ui/ModalShell";
import { Spinner } from "@/components/ui/Spinner";
import { cn } from "@/lib/cn";
import {
  defaultZdCreateUwagi,
  ZD_CREATE_MAX_UWAGI_LEN,
  ZD_CREATE_SOFT_WARN_LINES,
  type ZdCreatePreview,
} from "@/lib/orders/zd-estimate-create-zd";
import {
  composeZdCreateUwagiWithServices,
  type ZdEstimateIndividualServiceLine,
} from "@/lib/orders/zd-estimate-individual";
import { formatQty } from "@/lib/orders/zd-estimate-manual";
import type { ZdPostCreateMarkFreeze } from "@/lib/orders/zd-estimate-post-create";
import {
  zdEstimateCreateConfirmLabel,
  zdEstimateCreateProgressCompleteTitle,
  zdEstimateCreateProgressTitle,
  zdEstimateCreateTitleHint,
  zdEstimateProsbaWord,
  ZD_ESTIMATE_UI,
  type ImplicitPieceSnapshotNotice,
} from "@/lib/orders/zd-estimate-ui-copy";
import type { ZdEstimateRunMode } from "@/lib/orders/zd-estimate-scope";
import { controlFocusClass, panelTypography } from "@/lib/ui/ontime-theme";
import { ZdEstimateImplicitPieceNotice } from "@/components/zakupy/ZdEstimateImplicitPieceNotice";

export type ZdCreateSubmitFreezeSnap = {
  includedServiceOrderIds: string[];
  omittedServiceCount: number;
  individualCatalogOrderIds: string[];
  individualServiceOrderIds: string[];
  consumedOrderIds: string[];
};

export function ZdEstimateCreateZdDialog({
  open,
  supplierId,
  supplierName,
  khId,
  usedAlias,
  scopeLabel,
  dateKey,
  preview,
  scopeMode,
  grtId,
  cechaId,
  lineMeta,
  initialUwagi,
  uwagiBaseMaxLen = ZD_CREATE_MAX_UWAGI_LEN,
  individualCatalogOrderIds,
  serviceLinesForCompose = [],
  consumedOrderIds,
  markFreeze = null,
  excludedWithIndividualCount = 0,
  pendingReviewCount = 0,
  implicitPieceSnapshotNotice = null,
  onOpenPackaging,
  onOpenPairs,
  onClose,
  onCreated,
  onError,
  onSubmitStart,
  ordersIsLive,
  ordersPort,
  ordersHostLabel = null,
  extrasPolicy = "sum",
}: {
  open: boolean;
  supplierId: string;
  supplierName: string;
  khId: number;
  usedAlias: boolean;
  scopeLabel: string | null;
  dateKey: string;
  preview: ZdCreatePreview;
  scopeMode: ZdEstimateRunMode;
  grtId?: number | null;
  cechaId?: number | null;
  lineMeta?: ZdEstimateLinkLineMeta[] | null;
  /** Prefill bazy uwag — bez bloku usług (serwer dokłada usługi). */
  initialUwagi?: string | null;
  /** Max długość bazy (rezerwa na usługi). */
  uwagiBaseMaxLen?: number;
  /** Prośby katalogowe (extras na pozycjach create). */
  individualCatalogOrderIds?: string[] | null;
  /** Linie usług do live compose z aktualną bazą uwag. */
  serviceLinesForCompose?: readonly ZdEstimateIndividualServiceLine[];
  /** Prośby już pokryte tym ZD (Nowe, ale extras nie doliczać drugi raz). */
  consumedOrderIds?: string[] | null;
  markFreeze?: ZdPostCreateMarkFreeze | null;
  excludedWithIndividualCount?: number;
  /** Ile pozycji nadal „Do weryfikacji” (sesja) — soft warn, nie blokuje create. */
  pendingReviewCount?: number;
  implicitPieceSnapshotNotice?: ImplicitPieceSnapshotNotice | null;
  onOpenPackaging?: () => void;
  onOpenPairs?: () => void;
  onClose: () => void;
  onCreated: (info: {
    dokId: number;
    dokNrPelny: string;
    lineCount: number;
    snapshotOk: boolean;
    snapshotMessage?: string;
    createdUnitsByTwId: Map<number, number>;
    createdLines: Array<{ twId: number; ilosc: number }>;
    bumped: Array<{
      twId: number;
      from: number;
      to: number;
      extraPieces: number;
    }>;
    composedUwagi?: string | null;
    omittedServiceCount?: number;
    teethServiceCount?: number;
    includedServiceOrderIds?: string[];
    acceptedCatalogOrderIds?: string[];
  }) => void;
  onError: (message: string, opts?: { timeoutKhId?: number }) => void;
  onSubmitStart?: (snap: ZdCreateSubmitFreezeSnap) => void;
  ordersIsLive: boolean;
  ordersPort: number;
  ordersHostLabel?: string | null;
  extrasPolicy?: "sum" | "max";
}) {
  const uwagiId = useId();
  const confirmId = useId();
  const [uwagi, setUwagi] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [pending, startPending] = useTransition();
  const [progressStartedAtMs, setProgressStartedAtMs] = useState<number | null>(
    null
  );
  const [progressComplete, setProgressComplete] = useState(false);
  const [progressSnapshotOk, setProgressSnapshotOk] = useState<boolean | null>(
    null
  );

  const baseMax = Math.max(
    0,
    Math.min(ZD_CREATE_MAX_UWAGI_LEN, Math.trunc(uwagiBaseMaxLen) || ZD_CREATE_MAX_UWAGI_LEN)
  );

  useEffect(() => {
    if (!open) return;
    queueMicrotask(() => {
      setConfirmed(false);
      setProgressStartedAtMs(null);
      setProgressComplete(false);
      setProgressSnapshotOk(null);
      setUwagi(
        (initialUwagi?.trim() ||
          defaultZdCreateUwagi({
            scopeMode,
            scopeLabel,
            dateKey,
          })).slice(0, baseMax)
      );
    });
  }, [open, scopeMode, scopeLabel, dateKey, initialUwagi, baseMax]);

  const liveCompose = useMemo(
    () =>
      composeZdCreateUwagiWithServices({
        baseUwagi: uwagi,
        serviceLines: serviceLinesForCompose,
        maxLen: ZD_CREATE_MAX_UWAGI_LEN,
        prioritizeServices: true,
      }),
    [uwagi, serviceLinesForCompose]
  );

  const teethOrderIds = useMemo(() => {
    const ids = new Set<string>();
    for (const line of serviceLinesForCompose) {
      if (line.reason !== "teeth") continue;
      for (const r of line.requests) {
        const id = String(r.orderId ?? "").trim();
        if (id) ids.add(id);
      }
    }
    return ids;
  }, [serviceLinesForCompose]);

  const liveIncludedServiceIds = liveCompose.includedServiceOrderIds;
  const liveOmittedServiceCount = liveCompose.omittedServiceCount;
  const liveGlowneServiceCount = liveIncludedServiceIds.filter(
    (id) => !teethOrderIds.has(id)
  ).length;
  const catalogGlowneCount = markFreeze?.pendingGlowneCatalogIds.length ?? 0;
  const glowneCount = catalogGlowneCount + liveGlowneServiceCount;

  const uwagiRemaining = baseMax - uwagi.length;

  const catalogRequests = useMemo(
    () => markFreeze?.catalogRequests ?? [],
    [markFreeze]
  );
  const serviceLinesPreview = useMemo(() => {
    const lines = markFreeze?.serviceLines ?? [];
    const included = new Set(liveIncludedServiceIds);
    return lines
      .map((line) => ({
        ...line,
        requests: line.requests.filter((r) => included.has(r.orderId)),
      }))
      .filter((line) => line.requests.length > 0);
  }, [markFreeze, liveIncludedServiceIds]);

  const serviceUwagiPreview = useMemo(() => {
    const idx = liveCompose.uwagi.search(/Usługi:\s*/i);
    return idx >= 0 ? liveCompose.uwagi.slice(idx) : null;
  }, [liveCompose.uwagi]);

  const titleHint = useMemo(() => {
    const base = zdEstimateCreateTitleHint({
      isLive: ordersIsLive,
      port: ordersPort,
    });
    const host = ordersHostLabel?.trim();
    return host ? `${base} Host: ${host}.` : base;
  }, [ordersIsLive, ordersPort, ordersHostLabel]);

  if (!open) return null;

  const submit = () => {
    if (!confirmed || pending) return;
    const catalogIds = [...(individualCatalogOrderIds ?? [])];
    const serviceIdsForSubmit = [...liveIncludedServiceIds];
    const consumed = [...(consumedOrderIds ?? [])];
    const lineMetaSnap = lineMeta ?? null;
    const startedAt = Date.now();
    setProgressComplete(false);
    setProgressSnapshotOk(null);
    setProgressStartedAtMs(startedAt);
    onSubmitStart?.({
      includedServiceOrderIds: serviceIdsForSubmit,
      omittedServiceCount: liveOmittedServiceCount,
      individualCatalogOrderIds: catalogIds,
      individualServiceOrderIds: serviceIdsForSubmit,
      consumedOrderIds: consumed,
    });
    startPending(async () => {
      const res = await actionCreateZdFromEstimate({
        supplierId,
        uwagi,
        scopeMode,
        grtId: scopeMode === "grupa" ? (grtId ?? null) : null,
        cechaId: scopeMode === "cecha" ? (cechaId ?? null) : null,
        lines: preview.lines.map((l) => ({
          twId: l.twId,
          ilosc: l.ilosc,
          symbol: l.symbol || null,
          plu: l.plu ?? null,
        })),
        lineMeta: lineMetaSnap,
        confirmLiveCreate: ordersIsLive ? true : undefined,
        individualCatalogOrderIds: catalogIds,
        individualServiceOrderIds: serviceIdsForSubmit,
        consumedOrderIds: consumed,
      });
      if (!res.ok) {
        setProgressStartedAtMs(null);
        setProgressComplete(false);
        setProgressSnapshotOk(null);
        onError(res.message, {
          timeoutKhId: res.code === "timeout" ? res.supplierKhId : undefined,
        });
        return;
      }
      setProgressSnapshotOk(res.snapshotOk);
      setProgressComplete(true);
      const createdLines =
        res.createdLines?.length
          ? res.createdLines
          : preview.lines.map((l) => ({ twId: l.twId, ilosc: l.ilosc }));
      const createdUnitsByTwId = new Map<number, number>();
      for (const l of createdLines) {
        createdUnitsByTwId.set(l.twId, l.ilosc);
      }
      await new Promise<void>((resolve) => {
        window.setTimeout(resolve, 420);
      });
      onCreated({
        dokId: res.dokId,
        dokNrPelny: res.dokNrPelny,
        lineCount: res.lineCount,
        snapshotOk: res.snapshotOk,
        snapshotMessage: res.snapshotMessage,
        createdUnitsByTwId,
        createdLines,
        bumped: res.bumped ?? [],
        composedUwagi: res.composedUwagi ?? null,
        omittedServiceCount: res.omittedServiceCount,
        teethServiceCount: res.teethServiceCount,
        includedServiceOrderIds: res.includedServiceOrderIds,
        acceptedCatalogOrderIds: res.acceptedCatalogOrderIds,
      });
    });
  };

  const showProgress = pending && progressStartedAtMs != null;

  return (
    <ModalShell
      open
      onClose={onClose}
      title={
        showProgress
          ? progressComplete
            ? zdEstimateCreateProgressCompleteTitle({
                snapshotOk: progressSnapshotOk,
              })
            : zdEstimateCreateProgressTitle()
          : "Utwórz ZD w Subiekcie"
      }
      titleHint={titleHint}
      titleId="zd-estimate-create-zd-title"
      size="xl"
      tier="raised"
      disableBackdropClose={pending}
      bodyClassName={
        showProgress
          ? "px-4 py-3 sm:px-5 sm:py-4"
          : "space-y-4 px-5 py-4 sm:px-6 sm:py-5"
      }
      footer={
        showProgress ? null : (
          <div className="flex w-full flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button
              type="button"
              variant="ghost"
              className="min-h-11 w-full sm:w-auto"
              onClick={onClose}
              disabled={pending}
            >
              Anuluj
            </Button>
            <Button
              type="button"
              className="min-h-11 w-full sm:w-auto"
              onClick={submit}
              disabled={pending || !confirmed || preview.lineCount === 0}
            >
              {pending ? (
                <span className="inline-flex items-center gap-2">
                  <Spinner className="size-4" /> Tworzę ZD…
                </span>
              ) : (
                "Utwórz ZD"
              )}
            </Button>
          </div>
        )
      }
    >
      {showProgress ? (
        <ZdEstimateCreateZdProgressPanel
          startedAtMs={progressStartedAtMs}
          lineCount={preview.lineCount}
          supplierName={supplierName}
          forceComplete={progressComplete}
          snapshotOk={progressSnapshotOk}
        />
      ) : (
        <>
          <div className="rounded-lg border border-slate-200/90 bg-slate-50/80 px-3 py-2.5 text-sm text-slate-800">
            <p>
              <span className="font-medium">{supplierName}</span>
              <span className="text-slate-500"> · kontrahent {khId}</span>
              {usedAlias ? (
                <span className="ml-1 text-amber-800">
                  (alias — ustaw główny kh)
                </span>
              ) : null}
            </p>
            <p className="mt-1 text-slate-600">
              {preview.lineCount} poz. · suma do ZD{" "}
              <span className="font-medium tabular-nums text-slate-900">
                {formatQty(preview.zdUnitsSuma)}
              </span>
              {preview.piecesArrivingSuma > 0 &&
              preview.piecesArrivingSuma !== preview.zdUnitsSuma ? (
                <>
                  {" "}
                  · {formatQty(preview.piecesArrivingSuma)} szt
                </>
              ) : null}
              {scopeLabel ? (
                <>
                  {" "}
                  · zakres <span className="font-medium">{scopeLabel}</span>
                </>
              ) : null}
            </p>
            {glowneCount > 0 ? (
              <p className="mt-2 text-emerald-900">
                {ZD_ESTIMATE_UI.createAfterSuccessDecide}{" "}
                {glowneCount}{" "}
                {zdEstimateProsbaWord(glowneCount)}{" "}
                {glowneCount === 1
                  ? "kwalifikuje się"
                  : "kwalifikują się"}{" "}
                do osobnego Główne
                {catalogGlowneCount > 0 && liveGlowneServiceCount > 0
                  ? ` (${catalogGlowneCount} na pozycjach, ${liveGlowneServiceCount} w uwagach)`
                  : liveGlowneServiceCount > 0
                    ? " (usługi w uwagach)"
                    : ""}
                .
              </p>
            ) : (
              <p className="mt-2 text-slate-600">
                {ZD_ESTIMATE_UI.createAfterSuccessDecideNoGlowne}
              </p>
            )}
            {excludedWithIndividualCount > 0 ? (
              <p className="mt-2 text-amber-900">
                {excludedWithIndividualCount}{" "}
                {zdEstimateProsbaWord(excludedWithIndividualCount)}{" "}
                {excludedWithIndividualCount === 1
                  ? "z wykluczonej pozycji"
                  : "z wykluczonych pozycji"}{" "}
                {excludedWithIndividualCount === 1 ? "trafi" : "trafią"} do uwag
                jako usługa (bez ilości towaru).
              </p>
            ) : null}
            {liveOmittedServiceCount > 0 ? (
              <p className="mt-2 rounded-md border border-amber-200/80 bg-amber-50/80 px-2.5 py-2 text-xs text-amber-950">
                {liveOmittedServiceCount}{" "}
                {liveOmittedServiceCount === 1
                  ? "usługa nie zmieści się"
                  : "usług nie zmieści się"}{" "}
                w limicie uwag — te prośby{" "}
                <span className="font-semibold">nie wejdą na listę Główne</span>
                . {ZD_ESTIMATE_UI.createOmittedServicesHint}
              </p>
            ) : null}
            {pendingReviewCount > 0 ? (
              <p className="mt-2 rounded-md border border-amber-200/80 bg-amber-50/80 px-2.5 py-2 text-xs text-amber-950">
                {ZD_ESTIMATE_UI.createPendingReviewWarn(pendingReviewCount)}
              </p>
            ) : null}
            {preview.softWarnOverLimit ? (
              <p className="mt-2 text-amber-900">
                Dużo pozycji (&gt;{ZD_CREATE_SOFT_WARN_LINES}) — Subiekt może
                długo pracować; limit czasu to ok. 3 minuty.
              </p>
            ) : null}
            <p className="mt-2 text-xs leading-snug text-slate-600">
              {ZD_ESTIMATE_UI.createQtyBumpNote}
            </p>
            <p className="mt-1 text-xs leading-snug text-slate-600">
              {ZD_ESTIMATE_UI.createTeethNote}
            </p>
          </div>

          <div className="space-y-2">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <label
                htmlFor={uwagiId}
                className={cn(panelTypography.sectionLabel, "text-slate-700")}
              >
                Uwagi na ZD
              </label>
              <span
                className={cn(
                  "text-xs tabular-nums",
                  uwagiRemaining < 40 ? "text-amber-700" : "text-slate-500"
                )}
              >
                {uwagi.length}/{baseMax}
                {baseMax < ZD_CREATE_MAX_UWAGI_LEN
                  ? ` (rezerwa usług ${ZD_CREATE_MAX_UWAGI_LEN - baseMax})`
                  : ""}
                {liveOmittedServiceCount > 0
                  ? ` · +${liveOmittedServiceCount} usług skrócone`
                  : ""}
              </span>
            </div>
            <textarea
              id={uwagiId}
              value={uwagi}
              onChange={(e) => setUwagi(e.target.value.slice(0, baseMax))}
              rows={3}
              maxLength={baseMax}
              className={cn(
                controlFocusClass,
                "w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900"
              )}
            />
            {serviceUwagiPreview ? (
              <p className="rounded-md border border-emerald-200/80 bg-emerald-50/70 px-2.5 py-2 text-xs text-emerald-950">
                Serwer dołoży do uwag:{" "}
                <span className="font-medium">{serviceUwagiPreview}</span>
              </p>
            ) : null}
          </div>

          <ZdEstimateOrderPreviewTable
            lines={preview.lines}
            extrasPolicy={extrasPolicy}
          />

          <ZdEstimateCreateRequestsPreview
            catalogRequests={catalogRequests}
            serviceLines={serviceLinesPreview}
            glowneCatalogCount={catalogGlowneCount}
            glowneServiceCount={liveGlowneServiceCount}
            constrainHeight={false}
          />

          {implicitPieceSnapshotNotice ? (
            <ZdEstimateImplicitPieceNotice
              notice={implicitPieceSnapshotNotice}
              onOpenPackaging={onOpenPackaging}
              onOpenPairs={onOpenPairs}
            />
          ) : null}

          <label className="flex items-start gap-2 text-sm text-slate-700">
            <input
              id={confirmId}
              type="checkbox"
              checked={confirmed}
              onChange={(e) => setConfirmed(e.target.checked)}
              className="mt-1"
            />
            <span>
              {zdEstimateCreateConfirmLabel({
                isLive: ordersIsLive,
                port: ordersPort,
                markCount: glowneCount,
              })}
            </span>
          </label>
        </>
      )}
    </ModalShell>
  );
}
