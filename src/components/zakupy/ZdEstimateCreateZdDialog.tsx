"use client";

import { useEffect, useId, useMemo, useState, useTransition } from "react";
import { actionCreateZdFromEstimate } from "@/app/actions/zd-estimate";
import type { ZdEstimateLinkLineMeta } from "@/app/actions/zd-estimate";
import { ZdEstimateCreateZdProgressPanel } from "@/components/zakupy/ZdEstimateCreateZdProgress";
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
import type { ZdEstimateRunMode } from "@/lib/orders/zd-estimate-scope";
import { controlFocusClass, panelTypography } from "@/lib/ui/ontime-theme";

const PREVIEW_VISIBLE = 12;

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
  serviceUwagiPreview = null,
  excludedWithIndividualCount = 0,
  omittedServiceCount = 0,
  serviceMarkPreviewCount,
  onClose,
  onCreated,
  onError,
  onSubmitStart,
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
  /** Prośby-usługi do uwag + Główne. */
  individualServiceOrderIds?: string[] | null;
  /** Podgląd bloku usług, który serwer dołoży do uwag. */
  serviceUwagiPreview?: string | null;
  excludedWithIndividualCount?: number;
  omittedServiceCount?: number;
  /** Ile usług zmieści się w uwagach (podgląd mark) — domyślnie = service IDs. */
  serviceMarkPreviewCount?: number;
  onClose: () => void;
  onCreated: (info: {
    dokId: number;
    dokNrPelny: string;
    lineCount: number;
    snapshotOk: boolean;
    snapshotMessage?: string;
    createdUnitsByTwId: Map<number, number>;
    markedIndividualOrderIds?: string[];
    markIndividualsMessage?: string;
  }) => void;
  onError: (message: string, opts?: { timeoutKhId?: number }) => void;
  onSubmitStart?: () => void;
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
  }, [open, supplierName, scopeLabel, dateKey, initialUwagi, baseMax]);

  const visibleLines = useMemo(
    () => preview.lines.slice(0, PREVIEW_VISIBLE),
    [preview.lines]
  );
  const hiddenCount = Math.max(0, preview.lineCount - PREVIEW_VISIBLE);
  const uwagiRemaining = baseMax - uwagi.length;
  const catalogCount = individualCatalogOrderIds?.length ?? 0;
  const serviceCount = individualServiceOrderIds?.length ?? 0;
  const serviceMarkCount =
    serviceMarkPreviewCount != null
      ? Math.max(0, serviceMarkPreviewCount)
      : Math.max(0, serviceCount - omittedServiceCount);
  const markCount = catalogCount + serviceMarkCount;

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
        individualCatalogOrderIds: individualCatalogOrderIds ?? null,
        individualServiceOrderIds: individualServiceOrderIds ?? null,
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
      const createdUnitsByTwId = new Map<number, number>();
      for (const l of preview.lines) {
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
        markedIndividualOrderIds: res.markedIndividualOrderIds,
        markIndividualsMessage: res.markIndividualsMessage,
      });
    });
  };

  const showProgress = pending && progressStartedAtMs != null;

  return (
    <ModalShell
      open
      onClose={onClose}
      title="Utwórz ZD w Subiekcie"
      titleHint="Dokument powstanie na testowym Subiekcie (:5082). Nie da się cofnąć z OnTime. Termin realizacji ustawisz w Subiekcie. Historia szacunku zapisze się dla tego dostawcy, zakresu i hosta ORDERS. Po sukcesie odznaczymy włączone prośby jako Główne."
      titleId="zd-estimate-create-zd-title"
      size="lg"
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
              <span className="text-slate-500"> · kh_Id {khId}</span>
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
              {scopeLabel ? (
                <>
                  {" "}
                  · zakres <span className="font-medium">{scopeLabel}</span>
                </>
              ) : null}
            </p>
            {markCount > 0 ? (
              <p className="mt-2 text-emerald-900">
                Po utworzeniu ZD odznaczymy {markCount}{" "}
                {markCount === 1 ? "prośbę" : "próśb"} jako Główne
                {catalogCount > 0 && serviceMarkCount > 0
                  ? ` (${catalogCount} na pozycjach, ${serviceMarkCount} w uwagach)`
                  : serviceMarkCount > 0
                    ? " (usługi w uwagach)"
                    : ""}
                .
              </p>
            ) : null}
            {excludedWithIndividualCount > 0 ? (
              <p className="mt-2 text-amber-900">
                {excludedWithIndividualCount}{" "}
                {excludedWithIndividualCount === 1
                  ? "prośba z wykluczonej pozycji"
                  : "próśb z wykluczonych pozycji"}{" "}
                trafi do uwag jako usługa (bez qty towaru).
              </p>
            ) : null}
            {omittedServiceCount > 0 ? (
              <p className="mt-2 rounded-md border border-amber-200/80 bg-amber-50/80 px-2.5 py-2 text-xs text-amber-950">
                {omittedServiceCount}{" "}
                {omittedServiceCount === 1
                  ? "usługa nie zmieści się"
                  : "usług nie zmieści się"}{" "}
                w limicie uwag — te prośby{" "}
                <span className="font-semibold">nie zostaną odznaczone</span>{" "}
                jako Główne. Skróć bazę uwag albo obsłuż je w panelu Dziś.
              </p>
            ) : null}
            {preview.softWarnOverLimit ? (
              <p className="mt-2 text-amber-900">
                Dużo pozycji (&gt;{ZD_CREATE_SOFT_WARN_LINES}) — Sfera może
                długo pracować; timeout create to 180 s.
              </p>
            ) : null}
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

          <div className="overflow-hidden rounded-lg border border-slate-200">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-3 py-2 font-medium">Symbol</th>
                  <th className="px-3 py-2 font-medium">Nazwa</th>
                  <th className="px-3 py-2 text-right font-medium">Ilość</th>
                </tr>
              </thead>
              <tbody>
                {visibleLines.map((l) => (
                  <tr key={l.twId} className="border-t border-slate-100">
                    <td className="px-3 py-1.5 font-mono text-xs text-slate-700">
                      {l.symbol || "—"}
                    </td>
                    <td className="max-w-[14rem] truncate px-3 py-1.5 text-slate-800">
                      {l.nazwa}
                      {l.individualExtraPieces != null &&
                      l.individualExtraPieces > 0 ? (
                        <span className="ml-1 text-[10px] font-semibold uppercase text-emerald-700">
                          +prośba
                        </span>
                      ) : null}
                    </td>
                    <td className="px-3 py-1.5 text-right tabular-nums">
                      {l.ilosc}
                      {l.packagingHint ? (
                        <span className="ml-1 text-xs text-slate-400">
                          ({l.packagingHint})
                        </span>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {hiddenCount > 0 ? (
              <p className="border-t border-slate-100 bg-slate-50/80 px-3 py-2 text-xs text-slate-500">
                …i {hiddenCount} kolejnych pozycji
              </p>
            ) : null}
          </div>

          <label className="flex items-start gap-2 text-sm text-slate-700">
            <input
              id={confirmId}
              type="checkbox"
              checked={confirmed}
              onChange={(e) => setConfirmed(e.target.checked)}
              className="mt-1"
            />
            <span>
              Potwierdzam utworzenie ZD na testowym Subiekcie (:5082). Operacji
              nie da się cofnąć z OnTime
              {markCount > 0
                ? " — włączone prośby zostaną odznaczone jako Główne"
                : ""}
              .
            </span>
          </label>
        </>
      )}
    </ModalShell>
  );
}
