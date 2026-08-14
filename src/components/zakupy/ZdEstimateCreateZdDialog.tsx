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
import type { ZdPostCreateMarkFreeze } from "@/lib/orders/zd-estimate-post-create";
import { pendingGlowneOrderIds } from "@/lib/orders/zd-estimate-post-create";
import {
  zdEstimateCreateConfirmLabel,
  zdEstimateCreateTitleHint,
  zdEstimateProsbaWord,
  ZD_ESTIMATE_UI,
} from "@/lib/orders/zd-estimate-ui-copy";
import type { ZdEstimateRunMode } from "@/lib/orders/zd-estimate-scope";
import { controlFocusClass, panelTypography } from "@/lib/ui/ontime-theme";

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
  individualServiceOrderIds,
  consumedOrderIds,
  markFreeze = null,
  serviceUwagiPreview = null,
  excludedWithIndividualCount = 0,
  omittedServiceCount = 0,
  implicitPieceSnapshotHint = null,
  onClose,
  onCreated,
  onError,
  onSubmitStart,
  ordersIsLive,
  ordersPort,
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
  /** Prośby-usługi do uwag. */
  individualServiceOrderIds?: string[] | null;
  /** Prośby już pokryte tym ZD (Nowe, ale extras nie doliczać drugi raz). */
  consumedOrderIds?: string[] | null;
  markFreeze?: ZdPostCreateMarkFreeze | null;
  /** Podgląd bloku usług, który serwer dołoży do uwag. */
  serviceUwagiPreview?: string | null;
  excludedWithIndividualCount?: number;
  omittedServiceCount?: number;
  implicitPieceSnapshotHint?: string | null;
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
  }) => void;
  onError: (message: string, opts?: { timeoutKhId?: number }) => void;
  onSubmitStart?: () => void;
  /** true = LIVE :5080 (aktualna baza) — silniejsze ostrzeżenie + confirmLiveCreate. */
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
            supplierName,
            scopeLabel,
            dateKey,
          })).slice(0, baseMax)
      );
    });
  }, [open, supplierName, scopeLabel, dateKey, initialUwagi, baseMax]);

  const uwagiRemaining = baseMax - uwagi.length;
  const glowneCount = pendingGlowneOrderIds(markFreeze).length;

  const catalogRequests = useMemo(
    () => markFreeze?.catalogRequests ?? [],
    [markFreeze]
  );
  const serviceLines = useMemo(
    () => markFreeze?.serviceLines ?? [],
    [markFreeze]
  );

  if (!open) return null;

  const submit = () => {
    if (!confirmed || pending) return;
    const startedAt = Date.now();
    setProgressComplete(false);
    setProgressSnapshotOk(null);
    setProgressStartedAtMs(startedAt);
    onSubmitStart?.();
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
        lineMeta: lineMeta ?? null,
        confirmLiveCreate: ordersIsLive ? true : undefined,
        individualCatalogOrderIds: individualCatalogOrderIds ?? null,
        individualServiceOrderIds: individualServiceOrderIds ?? null,
        consumedOrderIds: consumedOrderIds ?? null,
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
      });
    });
  };

  const showProgress = pending && progressStartedAtMs != null;

  return (
    <ModalShell
      open
      onClose={onClose}
      title="Utwórz ZD w Subiekcie"
      titleHint={zdEstimateCreateTitleHint({
        isLive: ordersIsLive,
        port: ordersPort,
      })}
      titleId="zd-estimate-create-zd-title"
      size="full"
      tier="raised"
      disableBackdropClose={pending}
      bodyClassName="space-y-4 px-5 py-5 sm:px-6"
      footer={
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
                {preview.zdUnitsSuma}
              </span>
              {preview.piecesArrivingSuma > 0 &&
              preview.piecesArrivingSuma !== preview.zdUnitsSuma ? (
                <>
                  {" "}
                  · {preview.piecesArrivingSuma} szt
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
                do Główne
                {markFreeze &&
                markFreeze.pendingGlowneCatalogIds.length > 0 &&
                markFreeze.pendingGlowneServiceIds.length > 0
                  ? ` (${markFreeze.pendingGlowneCatalogIds.length} na pozycjach, ${markFreeze.pendingGlowneServiceIds.length} w uwagach)`
                  : markFreeze && markFreeze.pendingGlowneServiceIds.length > 0
                    ? " (usługi w uwagach)"
                    : ""}
                .
              </p>
            ) : (
              <p className="mt-2 text-slate-600">
                {ZD_ESTIMATE_UI.createAfterSuccessDecide}
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
            {omittedServiceCount > 0 ? (
              <p className="mt-2 rounded-md border border-amber-200/80 bg-amber-50/80 px-2.5 py-2 text-xs text-amber-950">
                {omittedServiceCount}{" "}
                {omittedServiceCount === 1
                  ? "usługa nie zmieści się"
                  : "usług nie zmieści się"}{" "}
                w limicie uwag — te prośby{" "}
                <span className="font-semibold">nie wejdą na listę Główne</span>
                . Skróć bazę uwag albo obsłuż je w panelu Dziś.
              </p>
            ) : null}
            {preview.softWarnOverLimit ? (
              <p className="mt-2 text-amber-900">
                Dużo pozycji (&gt;{ZD_CREATE_SOFT_WARN_LINES}) — Subiekt może
                długo pracować; limit czasu to ok. 3 minuty.
              </p>
            ) : null}
            {implicitPieceSnapshotHint ? (
              <p className="mt-2 rounded-md border border-amber-200/80 bg-amber-50/80 px-2.5 py-2 text-xs leading-snug text-amber-950">
                {implicitPieceSnapshotHint}
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
                {omittedServiceCount > 0
                  ? ` · +${omittedServiceCount} usług skrócone`
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
                "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900"
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
            serviceLines={serviceLines}
            glowneCatalogCount={markFreeze?.pendingGlowneCatalogIds.length}
            glowneServiceCount={markFreeze?.pendingGlowneServiceIds.length}
            constrainHeight={false}
          />

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
