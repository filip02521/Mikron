"use client";

import Link from "next/link";
import { useMemo, useState, type MouseEvent } from "react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { ModalShell } from "@/components/ui/ModalShell";
import { Spinner } from "@/components/ui/Spinner";
import { cn } from "@/lib/cn";
import { buttonPrimaryClass } from "@/lib/ui/ontime-theme";
import {
  assessProsbaLineStock,
  formatZkProsbaScopeLineBadge,
  isZkProsbaScopePartialStock,
  type ZkProsbaScopeLineInput,
} from "@/lib/orders/prosba-stock-check";
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
}) {
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

  const {
    stockByTwId,
    stockLoading,
    lineKeysToOrder,
    excludedByStockCount,
    allOnStock,
    stockFetchFailed,
  } = useZkProsbaLineKeysStockFilter(addedScopeLines, uncoveredAddedKeys, open);

  const [prefillError, setPrefillError] = useState<string | null>(null);

  const linesToAddCount = lineKeysToOrder.length;
  const onStockExcludedCount = excludedByStockCount;
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
  const redirectToOpenProsba = allOnStock && hasOpenMatchingProsba;
  const scopeStockMeta = zkWatchLineUiStateMeta("in_stock");

  const supplementOptions = {
    lineKeys: lineKeysToOrder,
    mode: "supplement" as const,
  };
  const prosbaHref = prosbaHrefFromZkWatch(watch, supplementOptions);

  function handleAddMissing(event: MouseEvent<HTMLAnchorElement>) {
    if (stockLoading || allOnStock || linesToAddCount === 0) {
      event.preventDefault();
      return;
    }
    const ok = stashZkProsbaPrefill(watch, supplementOptions);
    if (!ok) {
      event.preventDefault();
      setPrefillError("Nie udało się przygotować pozycji — odśwież ZK z Subiekta.");
      return;
    }
    setPrefillError(null);
    onConfirm();
  }

  const addButtonLabel = stockLoading
    ? "Sprawdzam stan…"
    : redirectToOpenProsba
      ? "Otwórz prośbę"
      : allOnStock
        ? "Wszystko na stanie — nie trzeba uzupełniać"
        : linesToAddCount === addedCount
          ? "Dodaj brakujące do prośby"
          : `Dodaj do prośby (${linesToAddCount})`;

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
      onClose={onLater}
      size="md"
      title={`${displayNumber} — nowe pozycje w Subiekcie${queueLabel}`}
      description={watch.client_label}
      bodyClassName="space-y-4"
      footer={
        <div className="flex w-full flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button type="button" variant="ghost" size="sm" onClick={onLater}>
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
          ) : allOnStock ? (
            <Button type="button" size="sm" disabled className="w-full sm:w-auto">
              {addButtonLabel}
            </Button>
          ) : stockLoading || linesToAddCount === 0 ? (
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
            Wyślesz uzupełniającą prośbę powiązaną z tym ZK — tylko z nowymi pozycjami.
            Wcześniejsze pozycje pozostają w dotychczasowych prośbach.
          </p>
        )}
      </div>

      {stockLoading ? (
        <p className="flex items-center gap-2 text-xs text-slate-600">
          <Spinner size="sm" />
          Sprawdzam stan magazynowy w Subiekcie…
        </p>
      ) : null}

      {stockFetchFailed ? (
        <p className="rounded-md border border-amber-200/90 bg-amber-50/80 px-3 py-2 text-xs leading-relaxed text-amber-950">
          Nie udało się pobrać stanu z Subiekta — do prośby trafią wszystkie nowe pozycje.
        </p>
      ) : null}

      {!stockLoading && onStockExcludedCount > 0 && !allOnStock ? (
        <p className={cn(salesTypography.rowMeta, "text-slate-600")}>
          {polishCountLabel(onStockExcludedCount, [
            "pozycja ma pełny stan",
            "pozycje mają pełny stan",
            "pozycji ma pełny stan",
          ])}{" "}
          — {onStockExcludedCount === 1 ? "nie trafi" : "nie trafią"} do prośby.
        </p>
      ) : null}

      {allOnStock && !redirectToOpenProsba ? (
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
          Nowe pozycje w ZK
        </p>
        {!stockLoading && onStockExcludedCount > 0 && !allOnStock ? (
          <p className={cn(salesTypography.rowMeta, "mb-2 text-slate-600")}>
            {polishCountLabel(linesToAddCount, [
              "pozycja trafi",
              "pozycje trafią",
              "pozycji trafi",
            ])}{" "}
            do prośby — pozostałe mają wystarczający stan.
          </p>
        ) : null}
        <ul
          className={cn(
            "divide-y divide-slate-100 rounded-lg border border-slate-200/90 bg-white",
            stockLoading && "pointer-events-none opacity-60"
          )}
          aria-busy={stockLoading || undefined}
        >
          {uncoveredAddedKeys.map((key) => {
            const line = lineByKey(lineViews, key);
            if (!line) return null;

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
            const stockBadgeLabel = formatZkProsbaScopeLineBadge({
              sufficient,
              markedInStock: sufficient,
              available: snap?.available ?? null,
              hasStockData: snap != null,
            });

            return (
              <li
                key={key}
                className={cn(
                  "flex items-start justify-between gap-2 px-3 py-2.5",
                  sufficient
                    ? scopeStockMeta.rowTintClass
                    : lineKeysToOrder.includes(key)
                      ? "bg-indigo-50/40"
                      : "bg-amber-50/50"
                )}
              >
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
                  {!stockLoading && (snap != null || sufficient) ? (
                    <span
                      className={cn(
                        salesTypography.kindTag,
                        "rounded-full px-1.5 py-0.5",
                        sufficient
                          ? scopeStockMeta.badgeClass
                          : partialStock
                            ? "bg-amber-100 text-amber-950 ring-1 ring-amber-200/80"
                            : "bg-indigo-100 text-indigo-900 ring-1 ring-indigo-200/70"
                      )}
                    >
                      {stockBadgeLabel}
                    </span>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </ModalShell>
  );
}
