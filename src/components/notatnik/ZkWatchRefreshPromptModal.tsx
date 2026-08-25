"use client";

import { userFacingErrorText } from "@/lib/ui/user-facing-error";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, type MouseEvent } from "react";
import { actionPatchZkWatchProsbaScopeLines } from "@/app/actions/sales-notepad";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { ModalShell } from "@/components/ui/ModalShell";
import {
  ZK_PROSBA_MODAL_BODY_CLASS,
  ZkProsbaModalCallout,
} from "@/components/notatnik/ZkProsbaModalCallout";
import { cn } from "@/lib/cn";
import { plPozycja } from "@/lib/ui/polish-plurals";
import { buttonPrimaryClass } from "@/lib/ui/ontime-theme";
import {
  assessProsbaLineStock,
  deriveZkProsbaScopeSuggestedOrderKeys,
  formatZkProsbaAutoMarkedHint,
  formatZkProsbaScopeLineBadge,
  formatZkProsbaScopeLineStockDetail,
  type ZkProsbaScopeLineInput,
} from "@/lib/orders/prosba-stock-check";
import { useTeethExemptTwIds, useTeethProductInfo } from "@/components/layout/TeethExemptContext";
import { shouldRedirectZkRefreshToOpenProsba } from "@/lib/sales/zk-watch-refresh-diff";
import { appendMojeFocusOrderIds } from "@/lib/orders/moje-order-focus";
import {
  prosbaHrefFromZkWatch,
  stashZkProsbaPrefill,
} from "@/lib/orders/zk-watch-prosba-prefill";
import { zkWatchTeethDraftsReady } from "@/lib/sales/zk-watch-teeth-draft";
import { buildMojeClientLink } from "@/lib/sales/notepad-follow-up";
import { formatZkWatchDisplayNumber } from "@/lib/sales/notepad-format";
import { formatZkProsbaCoverageSummary } from "@/lib/sales/zk-watch-coverage-summary";
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
  onRequireTeethDrafts,
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
  /** Gdy brak list zębów — zamknij prompt i otwórz modal szkiców. */
  onRequireTeethDrafts?: (watch: SalesZkWatch) => void;
}) {
  const router = useRouter();
  const teethExemptTwIds = useTeethExemptTwIds();
  const teethProductInfo = useTeethProductInfo();
  const teethRegistry = useMemo(
    () => ({
      twIds: teethProductInfo.twIds,
      manufacturerByTwId: teethProductInfo.manufacturerByTwId,
      productLineByTwId: teethProductInfo.productLineByTwId,
      kindByTwId: teethProductInfo.kindByTwId,
      catalogAvailable: teethProductInfo.catalogAvailable,
    }),
    [teethProductInfo]
  );
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
      setPrefillError(userFacingErrorText(e, "Nie udało się zapisać zakresu pozycji."));
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
        if (!zkWatchTeethDraftsReady(updated, teethRegistry, {
          lineKeys: supplementOptions?.lineKeys,
          requestKind: "zamowienie",
        })) {
          if (onRequireTeethDrafts) {
            onRequireTeethDrafts(updated);
            onConfirm();
            return;
          }
          setPrefillError(
            "Najpierw uzupełnij listę zębów na karcie ZK, potem dodaj pozycje do prośby."
          );
          return;
        }
        const ok = stashZkProsbaPrefill(updated, {
          ...supplementOptions,
          stockByTwId: rawStockByTwId,
          teethRegistry,
        });
        if (!ok) {
          setPrefillError(
            "Nie udało się przygotować pozycji — uzupełnij listę zębów lub odśwież ZK z Subiekta."
          );
          return;
        }
        const targetHref = prosbaHrefFromZkWatch(updated, supplementOptions);
        onConfirm();
        router.push(targetHref);
      } catch (e) {
        setPrefillError(userFacingErrorText(e, "Nie udało się zapisać zakresu pozycji."));
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
  const showQueueProgress =
    queuePosition != null && queueTotal != null && queueTotal > 1;
  const queueProgressPct = showQueueProgress
    ? Math.round((queuePosition / queueTotal) * 100)
    : 0;

  return (
    <ModalShell
      open={open}
      onClose={handleLater}
      size="md"
      title={`${displayNumber} — nowe pozycje w Subiekcie${queueLabel}`}
      description={watch.client_label}
      bodyClassName={ZK_PROSBA_MODAL_BODY_CLASS}
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
      {showQueueProgress ? (
        <ZkProsbaModalCallout tone="neutral" icon="none" role="status">
          <div className="flex items-center justify-between gap-3">
            <span className="font-semibold text-slate-800">
              Okno {queuePosition} z {queueTotal}
            </span>
            <span className="text-[11px] font-medium text-slate-500">
              Kolejne ZK po tej decyzji
            </span>
          </div>
          <div
            className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-200/90"
            aria-hidden
          >
            <div
              className="h-full rounded-full bg-indigo-500 transition-[width] duration-300"
              style={{ width: `${queueProgressPct}%` }}
            />
          </div>
        </ZkProsbaModalCallout>
      ) : null}

      <ZkProsbaModalCallout tone="amber">
        <p className="text-sm font-semibold text-amber-950">
          Dopisano{" "}
          {polishCountLabel(addedCount, ["pozycję", "pozycje", "pozycji"])} do tego ZK.
        </p>
        {statusSummary ? (
          <p className="mt-1 text-xs leading-relaxed text-amber-900/90">
            Pozostałe pozycje: {statusSummary}.
          </p>
        ) : null}
        {!redirectToOpenProsba ? (
          <p className="mt-1.5 text-xs leading-relaxed text-amber-900/85">
            Zaznacz nowe pozycje do uzupełniającej prośby. Wcześniejsze pozostają w dotychczasowych
            prośbach.
          </p>
        ) : null}
      </ZkProsbaModalCallout>

      {stockLoading ? (
        <ZkProsbaModalCallout tone="sky" icon="spinner" role="status">
          <span className="font-medium">Sprawdzam stan magazynowy w Subiekcie…</span>
        </ZkProsbaModalCallout>
      ) : null}

      {stockFetchTimedOut ? (
        <ZkProsbaModalCallout tone="amber" role="status">
          Sprawdzanie stanu trwa zbyt długo — zaznacz pozycje ręcznie lub oznacz na stanie.
        </ZkProsbaModalCallout>
      ) : null}

      {stockFetchFailed && !stockFetchTimedOut ? (
        <ZkProsbaModalCallout tone="amber" role="status">
          Nie udało się pobrać stanu z Subiekta — zaznacz ręcznie pozycje do zamówienia.
        </ZkProsbaModalCallout>
      ) : null}

      {!stockLoading && autoMarkedCount > 0 && linesToAddCount > 0 ? (
        <ZkProsbaModalCallout tone="info">
          {formatZkProsbaAutoMarkedHint(autoMarkedCount)}
        </ZkProsbaModalCallout>
      ) : null}

      {allOnStock && linesToAddCount === 0 && !redirectToOpenProsba ? (
        <ZkProsbaModalCallout tone="emerald">
          Subiekt potwierdza wystarczający stan na wszystkich nowych pozycjach — uzupełnienie
          prośby nie jest potrzebne.
        </ZkProsbaModalCallout>
      ) : null}

      {redirectToOpenProsba ? (
        <ZkProsbaModalCallout tone="indigo">
          Nowe pozycje mają wystarczający stan, ale jest już aktywna prośba powiązana z tym ZK —
          przejdź do niej, aby sprawdzić status.
        </ZkProsbaModalCallout>
      ) : null}

      {diff.quantityChanged.length > 0 ? (
        <ZkProsbaModalCallout tone="amber">
          Uwaga:{" "}
          {polishCountLabel(diff.quantityChanged.length, [
            "pozycja ma",
            "pozycje mają",
            "pozycji ma",
          ])}{" "}
          zmienioną ilość w Subiekcie — sprawdź, czy dotychczasowe prośby nadal są poprawne.
        </ZkProsbaModalCallout>
      ) : null}

      {prefillError ? (
        <ZkProsbaModalCallout tone="rose" role="alert">
          {prefillError}
        </ZkProsbaModalCallout>
      ) : null}

      <div className="space-y-1.5">
        <div className="flex items-center justify-between px-0.5">
          <span className={salesTypography.sectionLabel}>
            Nowe pozycje — zaznacz do prośby
          </span>
          <span className="text-[11px] font-medium text-slate-400">
            {addedCount} {plPozycja(addedCount)}
          </span>
        </div>
        {!stockLoading && selectionInitialized && skippedCount > 0 && linesToAddCount > 0 ? (
          <ZkProsbaModalCallout tone="info">
            {polishCountLabel(linesToAddCount, [
              "pozycja trafi",
              "pozycje trafią",
              "pozycji trafi",
            ])}{" "}
            do prośby — pozostałe pominięte.
          </ZkProsbaModalCallout>
        ) : null}
        <ul
          className={cn(
            "divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-200/80 bg-white shadow-sm",
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
              <li key={key}>
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
                    disabled={selectionBusy || patching}
                    onChange={() => toggleLine(key)}
                    aria-label={
                      markedForOrder
                        ? `${line.product} — do zamówienia, odznacz aby pominąć`
                        : `${line.product} — pominięte, zaznacz aby zamówić`
                    }
                    className="mt-0.5 size-4 shrink-0 rounded-md border-slate-300 text-indigo-600 transition-colors focus:ring-2 focus:ring-indigo-500/40 focus:ring-offset-0"
                  />
                  <div className="min-w-0 flex-1">
                    <p className={cn(salesTypography.rowTitle, "text-slate-900")}>{line.product}</p>
                    {(line.symbol || line.quantityLabel) && (
                      <p className={cn(salesTypography.rowMeta, "mt-0.5 text-slate-500")}>
                        {[line.symbol, line.quantityLabel].filter(Boolean).join(" · ")}
                      </p>
                    )}
                    {stockDetail && (
                      <p className="mt-0.5 text-[11px] leading-tight text-slate-400">
                        {stockDetail}
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
                          "rounded-full px-2 py-0.5 leading-none",
                          sufficient && !markedForOrder
                            ? "bg-emerald-100 text-emerald-950 ring-1 ring-emerald-200/80"
                            : "bg-amber-100 text-amber-950 ring-1 ring-amber-200/80"
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
