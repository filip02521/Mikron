"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { actionUpdateZkWatchProsbaScope } from "@/app/actions/sales-notepad";
import { actionFetchProsbaLineStock } from "@/app/actions/subiekt";
import { Button } from "@/components/ui/Button";
import { ModalShell } from "@/components/ui/ModalShell";
import { Spinner } from "@/components/ui/Spinner";
import { cn } from "@/lib/cn";
import {
  assessProsbaLineStock,
  buildZkProsbaScopeInitialOrderMarked,
  deriveZkProsbaScopeSuggestedOrderKeys,
  formatZkProsbaAutoMarkedHint,
  formatZkProsbaScopeLineBadge,
  isZkProsbaScopePartialStock,
  zkProsbaScopeAllLinesSufficient,
  zkProsbaScopeLineKeysToOrder,
  zkProsbaScopeStockFetchFailed,
  type ProsbaLineStockSnapshot,
} from "@/lib/orders/prosba-stock-check";
import { formatZkWatchDisplayNumber } from "@/lib/sales/notepad-format";
import { zkWatchLineUiStateMeta } from "@/lib/sales/zk-watch-line-ui-state";
import { buildZkWatchLineViews, parseZkWatchLineChecks } from "@/lib/sales/zk-watch-lines";
import {
  getZkWatchProsbaScopeLineKeys,
  needsProsbaByKeyFromChecks,
} from "@/lib/sales/zk-watch-prosba-scope";
import { salesTypography } from "@/lib/ui/ontime-theme";
import type { SalesZkWatch } from "@/types/database";

function useZkProsbaScopeSelection(watch: SalesZkWatch, open: boolean) {
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

  /** Zaznaczone = do zamówienia (prośba). */
  const [orderMarked, setOrderMarked] = useState<Set<string>>(() => new Set());
  const [stockByTwId, setStockByTwId] = useState<Record<number, ProsbaLineStockSnapshot>>({});
  const [stockLoading, setStockLoading] = useState(false);
  const [initializedFor, setInitializedFor] = useState<string | null>(null);
  const wasOpenRef = useRef(false);

  useEffect(() => {
    if (!open) {
      wasOpenRef.current = false;
      return;
    }
    const justOpened = !wasOpenRef.current;
    wasOpenRef.current = true;
    if (!justOpened && watch.id === initializedFor) return;

    const twIds = productLines
      .map((line) => line.subiektTwId)
      .filter((id): id is number => id != null && id > 0);

    let cancelled = false;

    const applyInitialMarked = (stock: Record<number, ProsbaLineStockSnapshot>) => {
      const keys = buildZkProsbaScopeInitialOrderMarked({
        lines: productLines,
        stockByTwId: stock,
        existingScope,
        needsProsbaByKey,
      });
      setOrderMarked(new Set(keys));
    };

    if (existingScope !== null) {
      void (async () => {
        applyInitialMarked({});
        setInitializedFor(watch.id);
        if (!twIds.length) {
          if (!cancelled) {
            setStockByTwId({});
            setStockLoading(false);
          }
          return;
        }
        setStockLoading(true);
        try {
          const stock = await actionFetchProsbaLineStock(twIds);
          if (!cancelled) setStockByTwId(stock);
        } catch {
          if (!cancelled) setStockByTwId({});
        } finally {
          if (!cancelled) setStockLoading(false);
        }
      })();
      return () => {
        cancelled = true;
      };
    }

    void (async () => {
      setStockLoading(true);
      try {
        const stock = twIds.length ? await actionFetchProsbaLineStock(twIds) : {};
        if (cancelled) return;
        setStockByTwId(stock);
        applyInitialMarked(stock);
        setInitializedFor(watch.id);
      } catch {
        if (!cancelled) {
          applyInitialMarked({});
          setInitializedFor(watch.id);
        }
      } finally {
        if (!cancelled) setStockLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [open, watch.id, existingScope, needsProsbaByKey, productLines, initializedFor]);

  return {
    productLines,
    orderMarked,
    setOrderMarked,
    stockByTwId,
    stockLoading,
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
  const { productLines, orderMarked, setOrderMarked, stockByTwId, stockLoading, hasExistingScope } =
    useZkProsbaScopeSelection(watch, open);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const displayNumber = formatZkWatchDisplayNumber(watch.zk_number);
  const scopeSkippedMeta = zkWatchLineUiStateMeta("scope_excluded");
  const scopeOrderMeta = zkWatchLineUiStateMeta("uncovered");
  const lineKeysToOrder = zkProsbaScopeLineKeysToOrder(productLines, orderMarked);
  const allLinesSufficient =
    !stockLoading && zkProsbaScopeAllLinesSufficient(productLines, stockByTwId);
  const noneMarkedForOrder = orderMarked.size === 0 && productLines.length > 0;
  const stockUnavailable =
    !stockLoading && zkProsbaScopeStockFetchFailed(productLines, stockByTwId);
  const autoMarkedCount =
    !stockLoading && !hasExistingScope
      ? deriveZkProsbaScopeSuggestedOrderKeys(productLines, stockByTwId).length
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

  return (
    <ModalShell
      open={open}
      onClose={onClose}
      disableBackdropClose={required}
      size="md"
      title={`${displayNumber} — co zamawiamy?`}
      description={watch.client_label}
      bodyClassName="space-y-4 px-5 py-4 sm:px-6"
      footer={
        <div className="flex w-full flex-col-reverse gap-2 sm:flex-row sm:justify-end">
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
            disabled={saving || stockLoading}
            onClick={() => void save()}
          >
            {saving
              ? "Zapisuję…"
              : stockLoading
                ? "Sprawdzam stan…"
                : lineKeysToOrder.length === 0
                  ? "Zapisz — bez prośby"
                  : `Zapisz (${lineKeysToOrder.length})`}
          </Button>
        </div>
      }
    >
      <div className="rounded-lg border border-indigo-200/80 bg-indigo-50/50 px-3 py-3 text-sm text-indigo-950">
        <p className="font-medium">Zaznacz pozycje, które chcesz zamówić.</p>
        <p className="mt-1 text-xs leading-relaxed text-indigo-900/85">
          Zaznaczone pozycje trafią do prośby u zakupów. Odznacz towar, który macie na stanie w
          Subiekcie. Oznaczenie „na magazynie” pojawi się dopiero po dostawie z prośby.
        </p>
      </div>

      {stockLoading ? (
        <p className="flex items-center gap-2 text-xs text-slate-600">
          <Spinner size="sm" />
          Sprawdzam stan magazynowy w Subiekcie…
        </p>
      ) : null}

      {stockUnavailable ? (
        <p className="rounded-md border border-amber-200/90 bg-amber-50/80 px-3 py-2 text-xs leading-relaxed text-amber-950">
          Nie udało się pobrać stanu z Subiekta — zaznacz ręcznie pozycje do zamówienia.
        </p>
      ) : null}

      {!stockLoading && autoMarkedCount > 0 && !noneMarkedForOrder ? (
        <p className={cn(salesTypography.rowMeta, "text-slate-600")}>
          {formatZkProsbaAutoMarkedHint(autoMarkedCount)}
        </p>
      ) : null}

      <ul
        className={cn(
          "divide-y divide-slate-100 rounded-lg border border-slate-200/90 bg-white",
          stockLoading && !hasExistingScope && "pointer-events-none opacity-60"
        )}
        aria-busy={stockLoading || undefined}
      >
        {productLines.map((line) => {
          const markedForOrder = orderMarked.has(line.key);
          const twId = line.subiektTwId;
          const snap = twId ? stockByTwId[twId] : undefined;
          const sufficient =
            twId != null &&
            snap != null &&
            assessProsbaLineStock({ requestedQty: line.quantity, stock: snap }) === "sufficient";
          const partialStock = isZkProsbaScopePartialStock({
            sufficient,
            hasStockData: snap != null,
            available: snap?.available ?? null,
          });
          const stockBadgeLabel = formatZkProsbaScopeLineBadge({
            sufficient,
            markedForOrder,
            available: snap?.available ?? null,
            hasStockData: snap != null,
          });

          return (
            <li key={line.key}>
              <label
                className={cn(
                  "flex cursor-pointer items-start gap-3 px-3 py-2.5 transition",
                  markedForOrder
                    ? "bg-indigo-50/40 hover:bg-indigo-50/55"
                    : sufficient
                      ? scopeSkippedMeta.rowTintClass
                      : scopeOrderMeta.rowTintClass
                )}
              >
                <input
                  type="checkbox"
                  checked={markedForOrder}
                  disabled={saving || stockLoading}
                  onChange={() => toggleLine(line.key)}
                  aria-label={
                    markedForOrder
                      ? `${line.product} — do zamówienia, odznacz aby pominąć`
                      : `${line.product} — pominięte, zaznacz aby zamówić`
                  }
                  className="mt-0.5 size-4 shrink-0 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                />
                <span className="min-w-0 flex-1">
                  <span className={cn(salesTypography.rowTitle, "block text-slate-900")}>
                    {line.product}
                  </span>
                  {(line.symbol || line.quantityLabel) && (
                    <span className={cn(salesTypography.rowMeta, "mt-0.5 block text-slate-600")}>
                      {[line.symbol, line.quantityLabel].filter(Boolean).join(" · ")}
                    </span>
                  )}
                </span>
                <span
                  className={cn(
                    salesTypography.kindTag,
                    "shrink-0 rounded-full px-1.5 py-0.5",
                    markedForOrder
                      ? partialStock
                        ? "bg-amber-100 text-amber-950 ring-1 ring-amber-200/80"
                        : "bg-indigo-100 text-indigo-900 ring-1 ring-indigo-200/70"
                      : sufficient
                        ? scopeSkippedMeta.badgeClass
                        : scopeOrderMeta.badgeClass
                  )}
                >
                  {stockBadgeLabel}
                </span>
              </label>
            </li>
          );
        })}
      </ul>

      {noneMarkedForOrder && !stockLoading ? (
        allLinesSufficient ? (
          <p className={cn(salesTypography.rowMeta, "text-slate-700")}>
            Subiekt potwierdza wystarczający stan na wszystkich pozycjach — zapisz, jeśli nic nie
            trzeba zamawiać.
          </p>
        ) : (
          <p className={cn(salesTypography.rowMeta, "text-amber-800")}>
            Nic nie zaznaczono do zamówienia — zaznacz pozycje, które chcesz wysłać w prośbie.
          </p>
        )
      ) : null}

      {error ? <p className="text-xs text-red-600">{error}</p> : null}
    </ModalShell>
  );
}
