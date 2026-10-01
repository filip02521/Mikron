"use client";

import { useEffect, useId, useMemo, useRef, useState, useTransition } from "react";
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
import type { ZdEstimateHostStrip } from "@/lib/orders/zd-estimate-host";
import {
  zdEstimateCreateConfirmLabel,
  zdEstimateCreateProgressAriaLabel,
  zdEstimateCreateTitleHint,
  zdEstimateProsbaWord,
  ZD_ESTIMATE_UI,
  type ImplicitPieceSnapshotNotice,
} from "@/lib/orders/zd-estimate-ui-copy";
import type { ZdEstimateRunMode } from "@/lib/orders/zd-estimate-scope";
import { controlFocusClass } from "@/lib/ui/ontime-theme";
import { ZdEstimateImplicitPieceNotice } from "@/components/zakupy/ZdEstimateImplicitPieceNotice";
import {
  IconAlertCircle,
  IconInfoCircle,
} from "@/components/icons/StrokeIcons";

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
  host = null,
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
  onError: (
    message: string,
    opts?: { timeoutKhId?: number; title?: string }
  ) => void;
  onSubmitStart?: (snap: ZdCreateSubmitFreezeSnap) => void;
  ordersIsLive: boolean;
  ordersPort: number;
  ordersHostLabel?: string | null;
  /** Belka hosta na loadingu create — ten sam model co Policz. */
  host?: ZdEstimateHostStrip | null;
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
  const wasCreatingRef = useRef(false);

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

  useEffect(() => {
    if (!open) {
      wasCreatingRef.current = false;
      return;
    }
    const creating = pending && progressStartedAtMs != null;
    if (creating) {
      wasCreatingRef.current = true;
      return;
    }
    if (!wasCreatingRef.current) return;
    wasCreatingRef.current = false;
    const confirm = document.getElementById(confirmId);
    if (!(confirm instanceof HTMLElement)) return;
    try {
      confirm.focus({ preventScroll: true });
    } catch {
      confirm.focus();
    }
  }, [open, pending, progressStartedAtMs, confirmId]);

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

  const warnings: Array<{ key: string; text: string }> = [];
  if (usedAlias) {
    warnings.push({
      key: "alias",
      text: `Kontrahent ${khId} to alias dostawcy — ustaw go jako główny kh na karcie dostawcy.`,
    });
  }
  if (pendingReviewCount > 0) {
    warnings.push({
      key: "review",
      text: ZD_ESTIMATE_UI.createPendingReviewWarn(pendingReviewCount),
    });
  }
  if (liveOmittedServiceCount > 0) {
    warnings.push({
      key: "omitted",
      text: `${liveOmittedServiceCount} ${
        liveOmittedServiceCount === 1 ? "usługa nie zmieści się" : "usług nie zmieści się"
      } w limicie uwag — te prośby nie wejdą na listę Główne. ${ZD_ESTIMATE_UI.createOmittedServicesHint}`,
    });
  }
  if (excludedWithIndividualCount > 0) {
    warnings.push({
      key: "excluded",
      text: `${excludedWithIndividualCount} ${zdEstimateProsbaWord(excludedWithIndividualCount)} ${
        excludedWithIndividualCount === 1 ? "z wykluczonej pozycji trafi" : "z wykluczonych pozycji trafią"
      } do uwag jako usługa (bez ilości towaru).`,
    });
  }
  if (preview.softWarnOverLimit) {
    warnings.push({
      key: "size",
      text: `Dużo pozycji (>${ZD_CREATE_SOFT_WARN_LINES}) — Subiekt może długo pracować; limit czasu to ok. 3 minuty.`,
    });
  }

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
          title: res.title,
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
      title={showProgress ? undefined : "Utwórz ZD w Subiekcie"}
      titleHint={showProgress ? undefined : titleHint}
      titleId="zd-estimate-create-zd-title"
      ariaLabel={showProgress ? zdEstimateCreateProgressAriaLabel() : undefined}
      size={showProgress ? "md" : "xl"}
      tier="raised"
      disableBackdropClose={pending}
      className={
        showProgress
          ? "border-0 bg-transparent shadow-none ring-0"
          : undefined
      }
      bodyClassName={
        showProgress
          ? "p-0"
          : "space-y-4 px-5 py-4 sm:px-6 sm:py-5"
      }
      footer={
        showProgress ? null : (
          <div className="flex w-full flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <label
              className={cn(
                "flex min-w-0 cursor-pointer items-start gap-2.5 rounded-md px-3 py-2 text-sm leading-snug ring-1 transition sm:max-w-[36rem]",
                confirmed
                  ? "bg-emerald-50/70 text-emerald-950 ring-emerald-200"
                  : ordersIsLive
                    ? "bg-amber-50/80 text-amber-950 ring-amber-200"
                    : "bg-slate-50 text-slate-800 ring-slate-200"
              )}
            >
              <input
                id={confirmId}
                type="checkbox"
                checked={confirmed}
                onChange={(e) => setConfirmed(e.target.checked)}
                className="mt-0.5 size-4 shrink-0 accent-indigo-600"
              />
              <span>
                {/* Decyzja Główne / plan jest w „Po utworzeniu” — tu krótko. */}
                {zdEstimateCreateConfirmLabel({
                  isLive: ordersIsLive,
                  port: ordersPort,
                })}
              </span>
            </label>
            <div className="flex shrink-0 flex-col-reverse gap-2 sm:flex-row sm:justify-end">
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
              title={
                !confirmed
                  ? "Najpierw zaznacz potwierdzenie obok"
                  : undefined
              }
            >
              {pending ? (
                <span className="inline-flex items-center gap-2">
                  <Spinner className="size-4" /> Tworzę ZD…
                </span>
              ) : (
                `Utwórz ZD (${preview.lineCount} poz.)`
              )}
            </Button>
            </div>
          </div>
        )
      }
    >
      {showProgress ? (
        <ZdEstimateCreateZdProgressPanel
          key={progressStartedAtMs}
          startedAtMs={progressStartedAtMs}
          lineCount={preview.lineCount}
          supplierName={supplierName}
          scopeLabel={scopeLabel}
          scopeMode={scopeMode}
          forceComplete={progressComplete}
          snapshotOk={progressSnapshotOk}
          ordersIsLive={ordersIsLive}
          host={
            host ?? {
              configured: true,
              isLive: ordersIsLive,
              port: ordersPort,
            }
          }
        />
      ) : (
        <>
          <div
            className={cn(
              "flex items-start gap-2.5 rounded-lg px-3.5 py-2.5 text-sm ring-1",
              ordersIsLive
                ? "bg-rose-50/80 text-rose-950 ring-rose-200"
                : "bg-sky-50/80 text-sky-950 ring-neutral-200"
            )}
          >
            <IconAlertCircle
              size={18}
              className={cn(
                "mt-0.5 shrink-0",
                ordersIsLive ? "text-rose-600" : "text-sky-600"
              )}
              aria-hidden
            />
            <p className="min-w-0 leading-snug">
              <span className="font-semibold">
                {ordersIsLive
                  ? "Aktualna baza Subiekta"
                  : "Testowy Subiekt"}
              </span>{" "}
              <span className="tabular-nums">(:{ordersPort})</span>
              {ordersHostLabel?.trim() ? (
                <span className="opacity-75"> · {ordersHostLabel.trim()}</span>
              ) : null}
              {" — "}
              dokumentu nie da się cofnąć z OnTime.
            </p>
          </div>

          <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <SummaryTile
              label="Dostawca"
              value={supplierName}
              sub={`kontrahent ${khId}${usedAlias ? " (alias)" : ""}`}
              className="col-span-2 sm:col-span-1"
            />
            <SummaryTile
              label="Pozycji"
              value={String(preview.lineCount)}
            />
            <SummaryTile
              label="Suma do ZD"
              value={formatQty(preview.zdUnitsSuma)}
              sub={
                preview.piecesArrivingSuma > 0 &&
                preview.piecesArrivingSuma !== preview.zdUnitsSuma
                  ? `przyjdzie ${formatQty(preview.piecesArrivingSuma)} szt`
                  : "jedn. dokumentu"
              }
            />
            <SummaryTile
              label={
                scopeMode === "cecha"
                  ? "Cecha"
                  : scopeMode === "grupa"
                    ? "Grupa"
                    : "Zakres"
              }
              value={scopeLabel?.trim() || "—"}
              className="col-span-2 sm:col-span-1"
            />
          </dl>

          {warnings.length > 0 ? (
            <ul
              className="space-y-1.5 rounded-lg bg-amber-50/80 px-3.5 py-2.5 text-sm text-amber-950 ring-1 ring-amber-200"
              aria-label="Do sprawdzenia przed utworzeniem"
            >
              {warnings.map((w) => (
                <li key={w.key} className="flex items-start gap-2 leading-snug">
                  <IconAlertCircle
                    size={16}
                    className="mt-0.5 shrink-0 text-amber-600"
                    aria-hidden
                  />
                  <span>{w.text}</span>
                </li>
              ))}
            </ul>
          ) : null}

          <div className="rounded-lg bg-slate-50/80 px-3.5 py-2.5 ring-1 ring-slate-200/80">
            <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
              <IconInfoCircle size={14} aria-hidden /> Po utworzeniu
            </p>
            <ul className="mt-1.5 list-disc space-y-1 pl-5 text-xs leading-relaxed text-slate-600 marker:text-slate-300">
              <li className={glowneCount > 0 ? "text-emerald-900" : undefined}>
                {glowneCount > 0 ? (
                  <>
                    Zdecydujesz, czy oznaczyć{" "}
                    <span className="font-semibold">
                      {glowneCount} {zdEstimateProsbaWord(glowneCount)}
                    </span>{" "}
                    jako Główne
                    {catalogGlowneCount > 0 && liveGlowneServiceCount > 0
                      ? ` (${catalogGlowneCount} na pozycjach, ${liveGlowneServiceCount} w uwagach)`
                      : liveGlowneServiceCount > 0
                        ? " (usługi w uwagach)"
                        : ""}{" "}
                    i czy oznaczyć plan jako złożony.
                  </>
                ) : (
                  ZD_ESTIMATE_UI.createAfterSuccessDecideNoGlowne
                )}
              </li>
              <li>{ZD_ESTIMATE_UI.createQtyBumpNote}</li>
              {teethOrderIds.size > 0 ? (
                <li>{ZD_ESTIMATE_UI.createTeethNote}</li>
              ) : null}
            </ul>
          </div>

          <div className="space-y-2">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <label
                htmlFor={uwagiId}
                className="text-sm font-semibold text-slate-700"
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

        </>
      )}
    </ModalShell>
  );
}

function SummaryTile({
  label,
  value,
  sub,
  className,
}: {
  label: string;
  value: string;
  sub?: string | null;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "min-w-0 rounded-lg bg-white px-3 py-2 ring-1 ring-slate-200/90",
        className
      )}
    >
      <dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
        {label}
      </dt>
      <dd
        className="mt-0.5 truncate text-base font-semibold tabular-nums text-slate-900"
        title={value}
      >
        {value}
      </dd>
      {sub ? (
        <dd className="truncate text-xs text-slate-500" title={sub}>
          {sub}
        </dd>
      ) : null}
    </div>
  );
}
