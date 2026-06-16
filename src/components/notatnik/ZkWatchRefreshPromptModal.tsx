"use client";

import Link from "next/link";
import { useMemo, useState, type MouseEvent } from "react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { ModalShell } from "@/components/ui/ModalShell";
import { cn } from "@/lib/cn";
import { formatZkWatchDisplayNumber } from "@/lib/sales/notepad-format";
import {
  buildZkWatchLineViews,
  type ZkWatchLineView,
} from "@/lib/sales/zk-watch-lines";
import type { ZkWatchOrderHints } from "@/lib/sales/zk-watch-order-link";
import { formatZkProsbaCoverageSummary } from "@/lib/sales/zk-watch-coverage-summary";
import type { ZkWatchRefreshDiff } from "@/lib/sales/zk-watch-refresh-diff";
import {
  prosbaHrefFromZkWatch,
  stashZkProsbaPrefill,
} from "@/lib/orders/zk-watch-prosba-prefill";
import { salesTypography } from "@/lib/ui/ontime-theme";
import type { SalesZkWatch } from "@/types/database";

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
  const supplementOptions = {
    lineKeys: uncoveredAddedKeys,
    mode: "supplement" as const,
  };
  const prosbaHref = prosbaHrefFromZkWatch(watch, supplementOptions);
  const [prefillError, setPrefillError] = useState<string | null>(null);

  function handleAddMissing(event: MouseEvent<HTMLAnchorElement>) {
    const ok = stashZkProsbaPrefill(watch, supplementOptions);
    if (!ok) {
      event.preventDefault();
      setPrefillError("Nie udało się przygotować pozycji — odśwież ZK z Subiekta.");
      return;
    }
    setPrefillError(null);
    onConfirm();
  }

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
          <Link href={prosbaHref} onClick={handleAddMissing}>
            <Button type="button" size="sm" className="w-full sm:w-auto">
              Dodaj brakujące do prośby
            </Button>
          </Link>
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
        <p className="mt-2 text-xs leading-relaxed text-amber-900/85">
          Wyślesz uzupełniającą prośbę powiązaną z tym ZK — tylko z nowymi pozycjami.
          Wcześniejsze pozycje pozostają w dotychczasowych prośbach.
        </p>
      </div>

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
          Nowe pozycje do dodania
        </p>
        <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200/90 bg-white">
          {uncoveredAddedKeys.map((key) => {
            const line = lineByKey(lineViews, key);
            if (!line) return null;
            return (
              <li
                key={key}
                className="flex items-start justify-between gap-2 px-3 py-2.5 bg-amber-50/50"
              >
                <div className="min-w-0">
                  <p className={cn(salesTypography.rowTitle, "text-slate-900")}>{line.product}</p>
                  {(line.symbol || line.quantityLabel) && (
                    <p className={cn(salesTypography.rowMeta, "mt-0.5 text-slate-600")}>
                      {[line.symbol, line.quantityLabel].filter(Boolean).join(" · ")}
                    </p>
                  )}
                </div>
                <Badge variant="warning" className="shrink-0 text-[9px]">
                  Nowa
                </Badge>
              </li>
            );
          })}
        </ul>
      </div>
    </ModalShell>
  );
}
