"use client";

import { useEffect, useMemo, useState } from "react";
import { actionUpdateZkWatchProsbaScope } from "@/app/actions/sales-notepad";
import { Button } from "@/components/ui/Button";
import { ModalShell } from "@/components/ui/ModalShell";
import { Spinner } from "@/components/ui/Spinner";
import { useProsbaLineStockBatchFetch } from "@/hooks/useProsbaLineStockBatchFetch";
import { cn } from "@/lib/cn";
import {
  adjustStockMapForZkLines,
  assessProsbaLineStock,
  buildZkProsbaScopeInitialOrderMarked,
  collectZkProsbaScopeLineTwIds,
  deriveZkProsbaScopeSuggestedOrderKeys,
  formatZkProsbaAutoMarkedHint,
  formatZkProsbaScopeLineBadge,
  formatZkProsbaScopeLineStockDetail,
  zkProsbaScopeAllLinesSufficient,
  zkProsbaScopeLineKeysToOrder,
  zkProsbaScopeStockFetchFailed,
} from "@/lib/orders/prosba-stock-check";
import { formatZkWatchDisplayNumber } from "@/lib/sales/notepad-format";
import { buildZkWatchLineViews, parseZkWatchLineChecks } from "@/lib/sales/zk-watch-lines";
import {
  getZkWatchProsbaScopeLineKeys,
  needsProsbaByKeyFromChecks,
} from "@/lib/sales/zk-watch-prosba-scope";
import { salesTypography } from "@/lib/ui/ontime-theme";
import { useTeethExemptTwIds } from "@/components/layout/TeethExemptContext";
import type { SalesZkWatch } from "@/types/database";
import {
  IconClipboardList,
  IconCircleCheck,
  IconAlertCircle,
  IconInfoCircle,
} from "@/components/icons/StrokeIcons";

function useZkProsbaScopeSelection(watch: SalesZkWatch, open: boolean) {
  const teethExemptTwIds = useTeethExemptTwIds();
  const lineViews = useMemo(() => buildZkWatchLineViews(watch), [watch]);
  const productLines = useMemo(
    () => lineViews.filter((line) => line.key !== "summary"),
    [lineViews]
  );
  const existingScope = useMemo(
    () => getZkWatchProsbaScopeLineKeys(watch, lineViews),
    [watch, lineViews]
  );
  const needsProsbaByKey = useMemo(
    () => needsProsbaByKeyFromChecks(parseZkWatchLineChecks(watch.line_checks)),
    [watch.line_checks]
  );
  const twIds = useMemo(() => collectZkProsbaScopeLineTwIds(productLines), [productLines]);

  const {
    stockByTwId: rawStockByTwId,
    loading: stockLoading,
    timedOut: stockFetchTimedOut,
  } = useProsbaLineStockBatchFetch(twIds, open);

  const stockByTwId = useMemo(
    () => adjustStockMapForZkLines(productLines, rawStockByTwId),
    [productLines, rawStockByTwId]
  );

  /** Zaznaczone = do zamówienia (prośba). */
  const [orderMarked, setOrderMarked] = useState<Set<string>>(() => new Set());
  const [scopeInitDone, setScopeInitDone] = useState(false);
  const [userTouchedSelection, setUserTouchedSelection] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (userTouchedSelection || stockLoading) return;

    if (existingScope !== null) {
      if (scopeInitDone) return;
      const keys = buildZkProsbaScopeInitialOrderMarked({
        lines: productLines,
        stockByTwId: {},
        existingScope,
        needsProsbaByKey,
        stockExemptTwIds: teethExemptTwIds,
      });
      queueMicrotask(() => {
        setOrderMarked(new Set(keys));
        setScopeInitDone(true);
      });
      return;
    }

    const hasStockData = Object.keys(stockByTwId).length > 0;
    if (!hasStockData && !stockFetchTimedOut) return;

    const keys = buildZkProsbaScopeInitialOrderMarked({
      lines: productLines,
      stockByTwId,
      existingScope,
      needsProsbaByKey,
      stockExemptTwIds: teethExemptTwIds,
    });
    queueMicrotask(() => setOrderMarked(new Set(keys)));
  }, [
    open,
    existingScope,
    needsProsbaByKey,
    productLines,
    stockByTwId,
    stockLoading,
    stockFetchTimedOut,
    scopeInitDone,
    userTouchedSelection,
    teethExemptTwIds,
  ]);

  function setOrderMarkedWithTouch(value: Set<string> | ((prev: Set<string>) => Set<string>)) {
    setUserTouchedSelection(true);
    setOrderMarked(value);
  }

  return {
    productLines,
    orderMarked,
    setOrderMarked: setOrderMarkedWithTouch,
    stockByTwId,
    rawStockByTwId,
    stockLoading,
    stockFetchTimedOut,
    hasExistingScope: existingScope !== null,
  };
}

export function ZkWatchProsbaScopeModal({
  watch,
  open,
  required = false,
  onClose,
  onSaved,
}: {
  watch: SalesZkWatch;
  open: boolean;
  /** Gdy true — nie można zamknąć bez zapisu (pierwsze dodanie ZK). */
  required?: boolean;
  onClose: () => void;
  onSaved: (watch: SalesZkWatch) => void;
}) {
  const teethExemptTwIds = useTeethExemptTwIds();
  const { productLines, orderMarked, setOrderMarked, stockByTwId, rawStockByTwId, stockLoading, stockFetchTimedOut, hasExistingScope } =
    useZkProsbaScopeSelection(watch, open);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const displayNumber = formatZkWatchDisplayNumber(watch.zk_number);
  const lineKeysToOrder = zkProsbaScopeLineKeysToOrder(productLines, orderMarked);
  const allLinesSufficient =
    !stockLoading && zkProsbaScopeAllLinesSufficient(productLines, stockByTwId, teethExemptTwIds);
  const noneMarkedForOrder = orderMarked.size === 0 && productLines.length > 0;
  const stockUnavailable =
    !stockLoading &&
    (stockFetchTimedOut || zkProsbaScopeStockFetchFailed(productLines, rawStockByTwId));
  const awaitingAutoMark = stockLoading && !hasExistingScope && !stockFetchTimedOut;
  const autoMarkedCount =
    !stockLoading && !hasExistingScope
      ? deriveZkProsbaScopeSuggestedOrderKeys(productLines, stockByTwId, teethExemptTwIds).length
      : 0;

  function toggleLine(key: string) {
    setOrderMarked((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  async function save() {
    if (saving) return;
    setSaving(true);
    setError(null);
    const keysToOrder = zkProsbaScopeLineKeysToOrder(productLines, orderMarked);
    try {
      const { watch: updated } = await actionUpdateZkWatchProsbaScope(watch.id, keysToOrder);
      onSaved(updated);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Nie udało się zapisać zakresu.");
    } finally {
      setSaving(false);
    }
  }

  const orderCount = lineKeysToOrder.length;
  const totalLines = productLines.length;

  return (
    <ModalShell
      open={open}
      onClose={onClose}
      disableBackdropClose={required}
      size="md"
      title={`${displayNumber} — co zamawiamy?`}
      description={watch.client_label}
      bodyClassName="space-y-3 px-5 py-4 sm:px-6"
      footer={
        <div className="flex w-full items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-xs text-slate-500">
            {orderCount > 0 ? (
              <>
                <span className="inline-flex size-5 items-center justify-center rounded-full bg-indigo-100 text-[10px] font-bold text-indigo-700">
                  {orderCount}
                </span>
                <span className="font-medium text-slate-700">
                  {orderCount === 1 ? "pozycja do zamówienia" : `${orderCount} pozycji do zamówienia`}
                </span>
              </>
            ) : (
              <span className="text-slate-400">Brak pozycji do zamówienia</span>
            )}
          </div>
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            {required ? (
              <Button type="button" variant="ghost" size="sm" onClick={onClose} disabled={saving}>
                Skonfiguruj później
              </Button>
            ) : (
              <Button type="button" variant="ghost" size="sm" onClick={onClose} disabled={saving}>
                Anuluj
              </Button>
            )}
            <Button
              type="button"
              size="sm"
              disabled={saving}
              onClick={() => void save()}
              className={cn(
                orderCount > 0 && !saving &&
                  "bg-indigo-600 hover:bg-indigo-700"
              )}
            >
              {saving
                ? "Zapisuję…"
                : awaitingAutoMark
                  ? "Sprawdzam stan…"
                  : orderCount === 0
                    ? "Zapisz — bez prośby"
                    : `Zapisz (${orderCount})`}
            </Button>
          </div>
        </div>
      }
    >
      {/* Info card — gradient with icon */}
      <div className="relative overflow-hidden rounded-xl border border-indigo-200/60 bg-gradient-to-br from-indigo-50/80 via-indigo-50/40 to-sky-50/30 px-4 py-3.5">
        <div className="flex items-start gap-3">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-indigo-100/80 text-indigo-600">
            <IconClipboardList size={18} strokeWidth={2} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-indigo-950">Zaznacz pozycje do zamówienia</p>
            <p className="mt-0.5 text-xs leading-relaxed text-indigo-900/70">
              Zaznaczone pozycje trafią do prośby u zakupów. Odznacz towar, który macie na stanie w
              Subiekcie — system uwzględnia rezerwacje z tego ZK. Oznaczenie &bdquo;na magazynie&rdquo; pojawi się dopiero po dostawie z prośby.
            </p>
          </div>
        </div>
      </div>

      {/* Stock loading state */}
      {stockLoading ? (
        <div className="flex items-center gap-2.5 rounded-lg border border-sky-200/60 bg-sky-50/50 px-3.5 py-2.5 text-xs text-sky-800">
          <Spinner size="sm" className="border-sky-200 border-t-sky-600" />
          <span className="font-medium">Sprawdzam stan magazynowy w Subiekcie…</span>
        </div>
      ) : null}

      {/* Stock timeout warning */}
      {stockFetchTimedOut ? (
        <div className="flex items-start gap-2.5 rounded-lg border border-amber-200/80 bg-amber-50/70 px-3.5 py-2.5 text-xs leading-relaxed text-amber-950">
          <IconAlertCircle size={16} className="mt-0.5 shrink-0 text-amber-600" />
          <span>Sprawdzanie stanu trwa zbyt długo — możesz zaznaczyć pozycje ręcznie lub zapisać bez automatycznego podpowiedzenia.</span>
        </div>
      ) : null}

      {/* Stock fetch failed */}
      {stockUnavailable && !stockFetchTimedOut ? (
        <div className="flex items-start gap-2.5 rounded-lg border border-amber-200/80 bg-amber-50/70 px-3.5 py-2.5 text-xs leading-relaxed text-amber-950">
          <IconAlertCircle size={16} className="mt-0.5 shrink-0 text-amber-600" />
          <span>Nie udało się pobrać stanu z Subiekta — zaznacz ręcznie pozycje do zamówienia.</span>
        </div>
      ) : null}

      {/* Auto-marked hint */}
      {!stockLoading && autoMarkedCount > 0 && !noneMarkedForOrder ? (
        <div className="flex items-center gap-2 rounded-lg bg-slate-50/80 px-3 py-2 text-xs text-slate-600">
          <IconInfoCircle size={14} className="shrink-0 text-slate-400" />
          <span>{formatZkProsbaAutoMarkedHint(autoMarkedCount)}</span>
        </div>
      ) : null}

      {/* Items list */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between px-1">
          <span className={salesTypography.sectionLabel}>
            Pozycje z ZK
          </span>
          <span className="text-[11px] font-medium text-slate-400">
            {totalLines} {totalLines === 1 ? "pozycja" : totalLines < 5 ? "pozycje" : "pozycji"}
          </span>
        </div>
        <ul
          className={cn(
            "divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-200/80 bg-white shadow-sm",
            awaitingAutoMark && "pointer-events-none opacity-60"
          )}
          aria-busy={awaitingAutoMark || undefined}
        >
          {productLines.map((line) => {
            const markedForOrder = orderMarked.has(line.key);
            const twId = line.subiektTwId;
            const snap = twId ? stockByTwId[twId] : undefined;
            const sufficient =
              twId != null &&
              snap != null &&
              assessProsbaLineStock({ requestedQty: line.quantity, stock: snap }) === "sufficient";
            const rawSnap = twId ? rawStockByTwId[twId] : undefined;
            const stockBadgeLabel = formatZkProsbaScopeLineBadge({
              sufficient,
              markedForOrder,
              available: snap?.available ?? null,
              hasStockData: snap != null,
            });
            const stockDetail = formatZkProsbaScopeLineStockDetail({
              sufficient,
              available: snap?.available ?? null,
              hasStockData: snap != null,
              onHand: snap?.onHand ?? null,
              zkLineQty: line.quantity,
              rawReserved: rawSnap?.reserved ?? null,
            });

            return (
              <li key={line.key}>
                <label
                  className={cn(
                    "flex cursor-pointer items-start gap-3 px-3.5 py-3 transition-colors duration-150",
                    sufficient && !markedForOrder
                      ? "bg-emerald-50/40 hover:bg-emerald-50/60"
                      : "bg-amber-50/40 hover:bg-amber-50/60"
                  )}
                >
                  <input
                    type="checkbox"
                    checked={markedForOrder}
                    disabled={saving || awaitingAutoMark}
                    onChange={() => toggleLine(line.key)}
                    aria-label={
                      markedForOrder
                        ? `${line.product} — do zamówienia, odznacz aby pominąć`
                        : `${line.product} — pominięte, zaznacz aby zamówić`
                    }
                    className="mt-0.5 size-4 shrink-0 rounded-md border-slate-300 text-indigo-600 transition-colors focus:ring-2 focus:ring-indigo-500/40 focus:ring-offset-0"
                  />
                  <span className="min-w-0 flex-1">
                    <span className={cn(salesTypography.rowTitle, "block text-slate-900")}>
                      {line.product}
                    </span>
                    {(line.symbol || line.quantityLabel) && (
                      <span className={cn(salesTypography.rowMeta, "mt-0.5 block text-slate-500")}>
                        {[line.symbol, line.quantityLabel].filter(Boolean).join(" · ")}
                      </span>
                    )}
                    {stockDetail && (
                      <span className="mt-0.5 block text-[11px] leading-tight text-slate-400">
                        {stockDetail}
                      </span>
                    )}
                  </span>
                  <span
                    className={cn(
                      salesTypography.kindTag,
                      "shrink-0 rounded-full px-2 py-0.5 leading-none",
                      sufficient && !markedForOrder
                        ? "bg-emerald-100 text-emerald-950 ring-1 ring-emerald-200/80"
                        : "bg-amber-100 text-amber-950 ring-1 ring-amber-200/80"
                    )}
                  >
                    {stockBadgeLabel}
                  </span>
                </label>
              </li>
            );
          })}
        </ul>
      </div>

      {/* Empty selection hint */}
      {noneMarkedForOrder && !stockLoading ? (
        allLinesSufficient ? (
          <div className="flex items-start gap-2.5 rounded-lg border border-emerald-200/70 bg-emerald-50/50 px-3.5 py-2.5 text-xs leading-relaxed text-emerald-900">
            <IconCircleCheck size={16} className="mt-0.5 shrink-0 text-emerald-600" />
            <span>Wszystkie pozycje są na stanie i zarezerwowane w tym ZK — zapisz, jeśli nic nie trzeba zamawiać u dostawcy.</span>
          </div>
        ) : (
          <div className="flex items-start gap-2.5 rounded-lg border border-amber-200/70 bg-amber-50/50 px-3.5 py-2.5 text-xs leading-relaxed text-amber-900">
            <IconAlertCircle size={16} className="mt-0.5 shrink-0 text-amber-600" />
            <span>Nic nie zaznaczono do zamówienia — zaznacz pozycje, które chcesz wysłać w prośbie.</span>
          </div>
        )
      ) : null}

      {/* Error */}
      {error ? (
        <div className="flex items-start gap-2.5 rounded-lg border border-rose-200/80 bg-rose-50/70 px-3.5 py-2.5 text-xs leading-relaxed text-rose-800" role="alert">
          <IconAlertCircle size={16} className="mt-0.5 shrink-0 text-rose-600" />
          <span>{error}</span>
        </div>
      ) : null}
    </ModalShell>
  );
}
