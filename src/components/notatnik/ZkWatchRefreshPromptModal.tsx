"use client";

import Link from "next/link";
import { useMemo, useState, type MouseEvent } from "react";
import { actionPatchZkWatchProsbaScopeLines } from "@/app/actions/sales-notepad";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { ModalShell } from "@/components/ui/ModalShell";
import { Spinner } from "@/components/ui/Spinner";
import { cn } from "@/lib/cn";
import { buttonPrimaryClass } from "@/lib/ui/ontime-theme";
import {
  assessProsbaLineStock,
  deriveZkProsbaScopeSuggestedOrderKeys,
  formatZkProsbaAutoMarkedHint,
  formatZkProsbaScopeLineBadge,
  hasZkReservation,
  isZkProsbaScopePartialStock,
  type ZkProsbaScopeLineInput,
} from "@/lib/orders/prosba-stock-check";
import { useTeethExemptTwIds } from "@/components/layout/TeethExemptContext";
import { shouldRedirectZkRefreshToOpenProsba } from "@/lib/sales/zk-watch-refresh-diff";
import { appendMojeFocusOrderIds } from "@/lib/orders/moje-order-focus";
import {
  prosbaHrefFromZkWatch,
  stashZkProsbaPrefill,
} from "@/lib/orders/zk-watch-prosba-prefill";
import { buildMojeClientLink } from "@/lib/sales/notepad-follow-up";
import { formatZkWatchDisplayNumber } from "@/lib/sales/notepad-format";
import { formatZkProsbaCoverageSummary } from "@/lib/sales/zk-watch-coverage-summary";
import { zkWatchLineUiStateMeta } from "@/lib/sales/zk-watch-line-ui-state";
import type { ZkWatchRefreshDiff } from "@/lib/sales/zk-watch-refresh-diff";
import {
  buildZkWatchLineViews,
  type ZkWatchLineView,
} from "@/lib/sales/zk-watch-lines";
import type { ZkWatchOrderHints } from "@/lib/sales/zk-watch-order-link";
import { salesTypography } from "@/lib/ui/ontime-theme";
import type { SalesZkWatch } from "@/types/database";
import { useZkProsbaLineKeysStockFilter } from "@/hooks/useZkProsbaLineKeysStockFilter";

function polishCountLabel(
  n: number,
  forms: [string, string, string]
): string {
  if (n === 1) return `${n} ${forms[0]}`;
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) {
    return `${n} ${forms[1]}`;
  }
  return `${n} ${forms[2]}`;
}

function lineByKey(views: ZkWatchLineView[], key: string): ZkWatchLineView | undefined {
  return views.find((line) => line.key === key);
}

function toScopeLine(line: ZkWatchLineView): ZkProsbaScopeLineInput {
  return {
    key: line.key,
    subiektTwId: line.subiektTwId,
    quantity: line.quantity,
  };
}

export function ZkWatchRefreshPromptModal({
  watch,
  diff,
  uncoveredAddedKeys,
  orderHints,
  queuePosition,
  queueTotal,
  open,
  onConfirm,
  onLater,
  onScopePatched,
}: {
  watch: SalesZkWatch;
  diff: ZkWatchRefreshDiff;
  uncoveredAddedKeys: string[];
  orderHints: ZkWatchOrderHints;
  queuePosition?: number;
  queueTotal?: number;
  open: boolean;
  onConfirm: () => void;
  onLater: () => void;
  onScopePatched?: (watch: SalesZkWatch) => void;
}) {
  const teethExemptTwIds = useTeethExemptTwIds();
  const lineViews = useMemo(() => buildZkWatchLineViews(watch), [watch]);
  const displayNumber = formatZkWatchDisplayNumber(watch.zk_number);
  const addedCount = uncoveredAddedKeys.length;
  const statusSummary = formatZkProsbaCoverageSummary(orderHints);

  const addedScopeLines = useMemo(
    () =>
      uncoveredAddedKeys
        .map((key) => lineByKey(lineViews, key))
        .filter((line): line is ZkWatchLineView => line != null)
        .map(toScopeLine),
    [uncoveredAddedKeys, lineViews]
  );

  const uncoveredKeysSig = uncoveredAddedKeys.join(",");

  const [orderMarked, setOrderMarked] = useState<Set<string>>(() => new Set());
  const [selectionEpoch, setSelectionEpoch] = useState("closed");
  const orderMarkedKeys = useMemo(() => [...orderMarked], [orderMarked]);

  const {
    stockByTwId,
    rawStockByTwId,
    stockLoading,
    lineKeysToOrder,
    unmarkedCount,
    allOnStock,
    stockFetchFailed,
    stockFetchTimedOut,
  } = useZkProsbaLineKeysStockFilter(addedScopeLines, uncoveredAddedKeys, open, {
    orderMarkedKeys,
  });

  const selectionSessionKey = open
    ? `${watch.id}:${uncoveredKeysSig}:${
        stockLoading ? "loading" : stockFetchFailed ? "failed" : "ready"
      }`
    : "closed";

  const suggestedOrderKeys = useMemo(() => {
    if (!open || stockLoading || stockFetchFailed) return [] as string[];
    return deriveZkProsbaScopeSuggestedOrderKeys(addedScopeLines, stockByTwId, teethExemptTwIds);
  }, [open, stockLoading, stockFetchFailed, addedScopeLines, stockByTwId, teethExemptTwIds]);

  if (selectionEpoch !== selectionSessionKey) {
    setSelectionEpoch(selectionSessionKey);
    setOrderMarked(
      selectionSessionKey === "closed" || stockFetchFailed
        ? new Set()
        : new Set(suggestedOrderKeys)
    );
  }

  const selectionInitialized =
    selectionSessionKey !== "closed" && !selectionSessionKey.endsWith(":loading");
  const selectionBusy = stockLoading || !selectionInitialized;

  const [prefillError, setPrefillError] = useState<string | null>(null);
  const [patching, setPatching] = useState(false);

  const linesToAddCount = lineKeysToOrder.length;
  const skippedCount = unmarkedCount;
  const autoMarkedCount =
    !stockLoading && selectionInitialized && !stockFetchFailed
      ? deriveZkProsbaScopeSuggestedOrderKeys(addedScopeLines, stockByTwId, teethExemptTwIds).length
      : 0;
  const hasOpenMatchingProsba = orderHints.matchingOpenRequestCount > 0;
  const prosbaInTokuHref = useMemo(
    () =>
      appendMojeFocusOrderIds(
        buildMojeClientLink(watch.sales_person_id, watch.client_label, {
          clientKhId: watch.client_kh_id,
          zkWatchId: watch.id,
          zkNumber: watch.zk_number,
        }),
        orderHints.matchingOpenRequestIds
      ),
    [watch, orderHints.matchingOpenRequestIds]
  );
  const redirectToOpenProsba = shouldRedirectZkRefreshToOpenProsba({
    allOnStock,
    hasOpenMatchingProsba,
    linesToAddCount,
  });
  const scopeSkippedMeta = zkWatchLineUiStateMeta("scope_excluded");
  const scopeOrderMeta = zkWatchLineUiStateMeta("uncovered");

  const supplementOptions = {
    lineKeys: lineKeysToOrder,
    mode: "supplement" as const,
  };
  const prosbaHref = prosbaHrefFromZkWatch(watch, supplementOptions);

  function toggleLine(key: string) {
    setOrderMarked((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  async function patchScopeAndFinish(lineKeysToOrder: string[]) {
    setPatching(true);
    setPrefillError(null);
    try {
      const { watch: updated } = await actionPatchZkWatchProsbaScopeLines(
        watch.id,
        lineKeysToOrder,
        uncoveredAddedKeys
      );
      onScopePatched?.(updated);
      onConfirm();
    } catch (e) {
      setPrefillError(e instanceof Error ? e.message : "Nie udało się zapisać zakresu pozycji.");
    } finally {
      setPatching(false);
    }
  }

  function handleAddMissing(event: MouseEvent<HTMLAnchorElement>) {
    if (selectionBusy || patching || linesToAddCount === 0) {
      event.preventDefault();
      return;
    }
    event.preventDefault();
    void (async () => {
      setPatching(true);
      setPrefillError(null);
      try {
        const { watch: updated } = await actionPatchZkWatchProsbaScopeLines(
          watch.id,
          lineKeysToOrder,
          uncoveredAddedKeys
        );
        onScopePatched?.(updated);
        const ok = stashZkProsbaPrefill(updated, {
          ...supplementOptions,
          stockByTwId: rawStockByTwId,
        });
        if (!ok) {
          setPrefillError("Nie udało się przygotować pozycji — odśwież ZK z Subiekta.");
          return;
        }
        onConfirm();
      } catch (e) {
        setPrefillError(e instanceof Error ? e.message : "Nie udało się zapisać zakresu pozycji.");
      } finally {
        setPatching(false);
      }
    })();
  }

  function handleMarkAllOnStock() {
    if (selectionBusy || patching || uncoveredAddedKeys.length === 0) return;
    void patchScopeAndFinish([]);
  }

  function handleLater() {
    onLater();
  }

  const canProceedToProsba = !selectionBusy && !patching && linesToAddCount > 0;

  const addButtonLabel = selectionBusy
    ? stockLoading
      ? "Sprawdzam stan…"
      : "Przygotowuję listę…"
    : patching
      ? "Zapisuję wybór…"
      : redirectToOpenProsba
        ? "Otwórz prośbę"
        : canProceedToProsba
          ? linesToAddCount === addedCount
            ? "Dodaj brakujące do prośby"
            : `Dodaj do prośby (${linesToAddCount})`
          : allOnStock
            ? "Oznacz na stanie i kontynuuj"
            : "Zaznacz pozycje do prośby";

  const primaryLinkButtonClass = cn(
    "inline-flex cursor-pointer items-center justify-center gap-2 font-medium transition-colors disabled:cursor-not-allowed disabled:pointer-events-none disabled:opacity-50",
    buttonPrimaryClass,
    "px-2.5 py-1.5 text-xs rounded-md leading-none w-full sm:w-auto"
  );
  const queueLabel =
    queuePosition != null && queueTotal != null && queueTotal > 1
      ? ` (${queuePosition} z ${queueTotal})`
      : "";

  return (
    <ModalShell
      open={open}
      onClose={handleLater}
      size="md"
      title={`${displayNumber} — nowe pozycje w Subiekcie${queueLabel}`}
      description={watch.client_label}
      bodyClassName="space-y-4 px-5 py-4 sm:px-6"
      footer={
        <div className="flex w-full flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button type="button" variant="ghost" size="sm" onClick={handleLater} disabled={patching}>
            Później
          </Button>
          {redirectToOpenProsba ? (
            <Link
              href={prosbaInTokuHref}
              onClick={onConfirm}
              className={primaryLinkButtonClass}
            >
              {addButtonLabel}
            </Link>
          ) : allOnStock && linesToAddCount === 0 ? (
            <Button
              type="button"
              size="sm"
              className="w-full sm:w-auto"
              disabled={selectionBusy || patching}
              onClick={handleMarkAllOnStock}
            >
              {addButtonLabel}
            </Button>
          ) : !canProceedToProsba ? (
            <Button type="button" size="sm" disabled className="w-full sm:w-auto">
              {addButtonLabel}
            </Button>
          ) : (
            <Link href={prosbaHref} onClick={handleAddMissing} className={primaryLinkButtonClass}>
              {addButtonLabel}
            </Link>
          )}
        </div>
      }
    >
      <div className="rounded-lg border border-amber-200/90 bg-amber-50/80 px-3 py-3 text-sm text-amber-950">
        <p className="font-medium">
          Dopisano{" "}
          {polishCountLabel(addedCount, ["pozycję", "pozycje", "pozycji"])} do tego ZK.
        </p>
        {statusSummary ? (
          <p className="mt-1 text-amber-900/90">
            Pozostałe pozycje: {statusSummary}.
          </p>
        ) : null}
        {redirectToOpenProsba ? (
          <p className="mt-2 text-xs leading-relaxed text-amber-900/85">
            Nowe pozycje mają wystarczający stan w Subiekcie — sprawdź aktywną prośbę powiązaną z
            tym ZK.
          </p>
        ) : (
          <p className="mt-2 text-xs leading-relaxed text-amber-900/85">
            Zaznacz nowe pozycje do uzupełniającej prośby powiązanej z tym ZK. Wcześniejsze pozycje
            pozostają w dotychczasowych prośbach.
          </p>
        )}
      </div>

      {stockLoading ? (
        <p className="flex items-center gap-2 text-xs text-slate-600">
          <Spinner size="sm" />
          Sprawdzam stan magazynowy w Subiekcie…
        </p>
      ) : null}

      {stockFetchTimedOut ? (
        <p className="rounded-md border border-amber-200/90 bg-amber-50/80 px-3 py-2 text-xs leading-relaxed text-amber-950">
          Sprawdzanie stanu trwa zbyt długo — zaznacz pozycje ręcznie lub oznacz na stanie.
        </p>
      ) : null}

      {stockFetchFailed && !stockFetchTimedOut ? (
        <p className="rounded-md border border-amber-200/90 bg-amber-50/80 px-3 py-2 text-xs leading-relaxed text-amber-950">
          Nie udało się pobrać stanu z Subiekta — zaznacz ręcznie pozycje do zamówienia.
        </p>
      ) : null}

      {!stockLoading && autoMarkedCount > 0 && linesToAddCount > 0 ? (
        <p className={cn(salesTypography.rowMeta, "text-slate-600")}>
          {formatZkProsbaAutoMarkedHint(autoMarkedCount)}
        </p>
      ) : null}

      {allOnStock && linesToAddCount === 0 && !redirectToOpenProsba ? (
        <p className={cn(salesTypography.rowMeta, "text-slate-700")}>
          Subiekt potwierdza wystarczający stan na wszystkich nowych pozycjach — uzupełnienie
          prośby nie jest potrzebne.
        </p>
      ) : null}

      {redirectToOpenProsba ? (
        <p className={cn(salesTypography.rowMeta, "text-indigo-900/90")}>
          Nowe pozycje mają wystarczający stan w Subiekcie, ale jest już aktywna prośba powiązana z
          tym ZK — przejdź do niej, aby sprawdzić status zamówienia.
        </p>
      ) : null}

      {diff.quantityChanged.length > 0 ? (
        <p className={cn(salesTypography.rowMeta, "text-slate-600")}>
          Uwaga: {diff.quantityChanged.length}{" "}
          {diff.quantityChanged.length === 1 ? "pozycja ma" : "pozycje mają"} zmienioną ilość w
          Subiekcie — sprawdź, czy dotychczasowe prośby nadal są poprawne.
        </p>
      ) : null}

      {prefillError ? (
        <p className={cn(salesTypography.rowMeta, "text-rose-700")}>{prefillError}</p>
      ) : null}

      <div>
        <p className={cn(salesTypography.kindTag, "mb-2 text-slate-500")}>
          Nowe pozycje w ZK — zaznacz do prośby
        </p>
        {!stockLoading && selectionInitialized && skippedCount > 0 && linesToAddCount > 0 ? (
          <p className={cn(salesTypography.rowMeta, "mb-2 text-slate-600")}>
            {polishCountLabel(linesToAddCount, [
              "pozycja trafi",
              "pozycje trafią",
              "pozycji trafi",
            ])}{" "}
            do prośby — pozostałe pominięte.
          </p>
        ) : null}
        <ul
          className={cn(
            "divide-y divide-slate-100 rounded-lg border border-slate-200/90 bg-white",
            selectionBusy && "pointer-events-none opacity-60"
          )}
          aria-busy={selectionBusy || undefined}
        >
          {uncoveredAddedKeys.map((key) => {
            const line = lineByKey(lineViews, key);
            if (!line) return null;

            const markedForOrder = orderMarked.has(key);
            const twId = line.subiektTwId;
            const snap = twId ? stockByTwId[twId] : undefined;
            const sufficient =
              twId != null &&
              snap != null &&
              assessProsbaLineStock({ requestedQty: line.quantity, stock: snap }) ===
                "sufficient";
            const partialStock = isZkProsbaScopePartialStock({
              sufficient,
              hasStockData: snap != null,
              available: snap?.available ?? null,
            });
            const rawSnap = twId ? rawStockByTwId[twId] : undefined;
            const zkReserved = hasZkReservation({
              zkLineQty: line.quantity,
              rawReserved: rawSnap?.reserved ?? null,
            });
            const stockBadgeLabel = formatZkProsbaScopeLineBadge({
              sufficient,
              markedForOrder,
              available: snap?.available ?? null,
              hasStockData: snap != null,
              onHand: snap?.onHand ?? null,
              reserved: snap?.reserved ?? null,
              zkLineQty: line.quantity,
              rawReserved: rawSnap?.reserved ?? null,
            });

            return (
              <li key={key}>
                <label
                  className={cn(
                    "flex cursor-pointer items-start gap-3 px-3 py-2.5 transition",
                    markedForOrder
                      ? "bg-indigo-50/40 hover:bg-indigo-50/55"
                      : sufficient
                        ? zkReserved
                          ? "bg-emerald-50/50 hover:bg-emerald-50/65"
                          : scopeSkippedMeta.rowTintClass
                        : scopeOrderMeta.rowTintClass
                  )}
                >
                  <input
                    type="checkbox"
                    checked={markedForOrder}
                    disabled={selectionBusy || patching}
                    onChange={() => toggleLine(key)}
                    aria-label={
                      markedForOrder
                        ? `${line.product} — do zamówienia, odznacz aby pominąć`
                        : `${line.product} — pominięte, zaznacz aby zamówić`
                    }
                    className="mt-0.5 size-4 shrink-0 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  <div className="min-w-0 flex-1">
                    <p className={cn(salesTypography.rowTitle, "text-slate-900")}>{line.product}</p>
                    {(line.symbol || line.quantityLabel) && (
                      <p className={cn(salesTypography.rowMeta, "mt-0.5 text-slate-600")}>
                        {[line.symbol, line.quantityLabel].filter(Boolean).join(" · ")}
                      </p>
                    )}
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <Badge variant="warning" className="text-[9px]">
                      Nowa
                    </Badge>
                    {!selectionBusy && (snap != null || sufficient || selectionInitialized) ? (
                      <span
                        className={cn(
                          salesTypography.kindTag,
                          "rounded-full px-1.5 py-0.5",
                          markedForOrder
                            ? partialStock
                              ? "bg-amber-100 text-amber-950 ring-1 ring-amber-200/80"
                              : "bg-indigo-100 text-indigo-900 ring-1 ring-indigo-200/70"
                            : sufficient
                              ? zkReserved
                                ? "bg-emerald-100 text-emerald-950 ring-1 ring-emerald-200/80"
                                : scopeSkippedMeta.badgeClass
                              : scopeOrderMeta.badgeClass
                        )}
                      >
                        {stockBadgeLabel}
                      </span>
                    ) : null}
                  </div>
                </label>
              </li>
            );
          })}
        </ul>
      </div>
    </ModalShell>
  );
}
