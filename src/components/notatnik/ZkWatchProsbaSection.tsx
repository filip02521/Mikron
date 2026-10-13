"use client";

import { useMemo } from "react";
import Link from "next/link";
import { IconChevronRight } from "@/components/icons/StrokeIcons";
import { Badge } from "@/components/ui/Badge";
import { cn } from "@/lib/cn";
import { appendMojeFocusOrderIds } from "@/lib/orders/moje-order-focus";
import { buildMojeClientLink } from "@/lib/sales/notepad-follow-up";
import {
  buildZkWatchProsbaPreviewEntries,
  formatZkProsbaPreviewMetaLine,
  formatZkProsbaPreviewMetaTooltip,
  type ZkWatchProsbaPreviewEntry,
} from "@/lib/sales/zk-watch-prosba-preview";
import type { ZkLinkableOrder, ZkWatchOrderHints } from "@/lib/sales/zk-watch-order-link";
import { collectPartialLineKeysFromCoverage } from "@/lib/sales/zk-watch-order-link";
import { deriveZkWatchProsbaCardAction } from "@/lib/sales/zk-watch-line-ui-state";
import { buildZkWatchLineViews } from "@/lib/sales/zk-watch-lines";
import { salesTypography } from "@/lib/ui/ontime-theme";
import { Button } from "@/components/ui/Button";
import { ZK_MODAL_PROSBA_COPY, ZK_MODAL_SECTION_TITLES } from "@/lib/sales/zk-modal-section-copy";
import type { SalesZkWatch } from "@/types/database";
import { ZkWatchProsbaCoveredPanel } from "./ZkWatchProsbaCoveredPanel";
import { ZkWatchModalSection } from "./ZkWatchModalSection";

export function ZkWatchProsbaSection({
  watch,
  linkableOrders = [],
  orderHints,
  readOnly,
  tourPreview = false,
  archived,
  newLineKeys = [],
  onRequestProsba,
}: {
  /** Zamyka modal i uruchamia akcję prośby z karty ZK (ta sama logika). */
  onRequestProsba?: () => void;
  watch: SalesZkWatch;
  linkableOrders?: ZkLinkableOrder[];
  orderHints?: ZkWatchOrderHints;
  readOnly?: boolean;
  tourPreview?: boolean;
  archived?: boolean;
  newLineKeys?: string[];
}) {
  const previewEntries = useMemo(
    () => buildZkWatchProsbaPreviewEntries(watch, linkableOrders, orderHints),
    [watch, linkableOrders, orderHints]
  );
  const openEntries = useMemo(
    () => previewEntries.filter((entry) => entry.isOpen),
    [previewEntries]
  );
  const closedEntries = useMemo(
    () => previewEntries.filter((entry) => !entry.isOpen),
    [previewEntries]
  );

  const lineViews = useMemo(() => buildZkWatchLineViews(watch), [watch]);
  const productLineCount = lineViews.filter((line) => line.key !== "summary").length;
  const prosbaCardAction = deriveZkWatchProsbaCardAction({
    lineCount: productLineCount,
    uncoveredLineKeys: orderHints?.uncoveredLineKeys ?? [],
    openProsbaLineKeys: orderHints?.openProsbaCoveredLineKeys ?? [],
    partialLineKeys: collectPartialLineKeysFromCoverage(orderHints?.lineCoverageByKey),
    regalWaitingLineKeys: orderHints?.regalWaitingLineKeys ?? [],
    informacjaReadyLineKeys: orderHints?.informacjaReadyLineKeys ?? [],
    scopeExcludedLineKeys: orderHints?.scopeExcludedLineKeys ?? [],
    newLineKeys,
    hasOpenMatchingProsba: (orderHints?.matchingOpenRequestCount ?? 0) > 0,
  });

  const mojeBaseHref = buildMojeClientLink(watch.sales_person_id, watch.client_label, {
    preview: readOnly || tourPreview,
    clientKhId: watch.client_kh_id,
    zkWatchId: watch.id,
    zkNumber: watch.zk_number,
  });

  function mojeFocusHref(orderId: string) {
    return appendMojeFocusOrderIds(mojeBaseHref, [orderId]);
  }

  if (archived) {
    if (!previewEntries.length) return null;
  }

  // Cały wiersz prowadzi do prośby w „Moje zamówienia” — bez osobnego przycisku „Podgląd” przy każdej pozycji.
  function renderProsbaEntry(entry: ZkWatchProsbaPreviewEntry) {
    return (
      <li key={entry.order.id}>
        <Link
          href={mojeFocusHref(entry.order.id)}
          title={ZK_MODAL_PROSBA_COPY.previewLinkTitle}
          className={cn(
            "group flex items-center gap-3 px-3 py-2.5 transition-colors hover:bg-slate-50",
            "focus-visible:relative focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-indigo-500/45"
          )}
        >
          <span className="min-w-0 flex-1">
            <span className={cn(salesTypography.rowBody, "block font-medium text-slate-800")}>{entry.productLabel}</span>
            <span className="mt-1 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
              <Badge variant={entry.statusBadgeVariant} className="shrink-0">
                {entry.statusLabel}
              </Badge>
              <span
                className={cn(salesTypography.rowMeta, "min-w-0 line-clamp-2 tabular-nums leading-snug")}
                title={formatZkProsbaPreviewMetaTooltip(entry)}
              >
                {formatZkProsbaPreviewMetaLine(entry)}
              </span>
            </span>
          </span>
          <IconChevronRight
            size={16}
            aria-hidden
            className="shrink-0 text-slate-400 transition-transform group-hover:translate-x-0.5 group-hover:text-slate-600 motion-reduce:transition-none"
          />
        </Link>
      </li>
    );
  }

  const listClass = "divide-y divide-slate-100 overflow-hidden rounded-[var(--radius-surface)] border border-slate-200/90 bg-white";

  return (
    <ZkWatchModalSection title={ZK_MODAL_SECTION_TITLES.prosba}>
      {previewEntries.length > 0 ? (
        <div className="space-y-3">
          {openEntries.length > 0 ? (
            <ul className={listClass}>{openEntries.map(renderProsbaEntry)}</ul>
          ) : null}
          {closedEntries.length > 0 ? (
            <div className="space-y-2">
              {openEntries.length > 0 ? (
                <p className={cn(salesTypography.rowMeta, "text-slate-500")}>
                  Wcześniejsze prośby
                </p>
              ) : null}
              <ul className={listClass}>{closedEntries.map(renderProsbaEntry)}</ul>
            </div>
          ) : null}
        </div>
      ) : prosbaCardAction.kind === "covered" ? (
        <ZkWatchProsbaCoveredPanel reason={prosbaCardAction.reason} />
      ) : !archived ? (
        <div>
          <p className={cn(salesTypography.rowBody, "text-slate-600")}>
            {ZK_MODAL_PROSBA_COPY.emptyTitle}
          </p>
          {/* Akcja tylko tam, gdzie można działać — w podglądzie bez instrukcji odsyłających gdzie indziej. */}
          {onRequestProsba && (prosbaCardAction.kind === "new_prosba" || prosbaCardAction.kind === "supplement") ? (
            <Button type="button" size="sm" className="mt-2" onClick={onRequestProsba}>
              {prosbaCardAction.label}
            </Button>
          ) : null}
        </div>
      ) : (
        <p className={cn(salesTypography.rowMeta, "text-slate-500")}>
          {ZK_MODAL_PROSBA_COPY.archivedEmpty}
        </p>
      )}
    </ZkWatchModalSection>
  );
}
