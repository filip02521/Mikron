"use client";

import { useMemo } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/Badge";
import { cn } from "@/lib/cn";
import { appendMojeFocusOrderIds } from "@/lib/orders/moje-order-focus";
import { buildMojeClientLink } from "@/lib/sales/notepad-follow-up";
import {
  buildZkWatchOpenProsbaPreviewEntries,
  formatZkProsbaPreviewMetaLine,
  formatZkProsbaPreviewMetaTooltip,
} from "@/lib/sales/zk-watch-prosba-preview";
import type { ZkLinkableOrder, ZkWatchOrderHints } from "@/lib/sales/zk-watch-order-link";
import { collectPartialLineKeysFromCoverage } from "@/lib/sales/zk-watch-order-link";
import { deriveZkWatchProsbaCardAction } from "@/lib/sales/zk-watch-line-ui-state";
import { buildZkWatchLineViews } from "@/lib/sales/zk-watch-lines";
import { salesTypography } from "@/lib/ui/ontime-theme";
import { ZK_MODAL_PROSBA_COPY, ZK_MODAL_SECTION_HINTS, ZK_MODAL_SECTION_TITLES } from "@/lib/sales/zk-modal-section-copy";
import type { SalesZkWatch } from "@/types/database";
import { ZkWatchModalSection } from "./ZkWatchModalSection";

export function ZkWatchProsbaSection({
  watch,
  linkableOrders = [],
  orderHints,
  readOnly,
  tourPreview = false,
  archived,
  newLineKeys = [],
}: {
  watch: SalesZkWatch;
  linkableOrders?: ZkLinkableOrder[];
  orderHints?: ZkWatchOrderHints;
  readOnly?: boolean;
  tourPreview?: boolean;
  archived?: boolean;
  newLineKeys?: string[];
}) {
  const openEntries = useMemo(
    () => buildZkWatchOpenProsbaPreviewEntries(watch, linkableOrders, orderHints),
    [watch, linkableOrders, orderHints]
  );

  const lineViews = useMemo(() => buildZkWatchLineViews(watch), [watch]);
  const productLineCount = lineViews.filter((line) => line.key !== "summary").length;
  const prosbaCardAction = deriveZkWatchProsbaCardAction({
    lineCount: productLineCount,
    uncoveredLineKeys: orderHints?.uncoveredLineKeys ?? [],
    openProsbaLineKeys: orderHints?.openProsbaCoveredLineKeys ?? [],
    partialLineKeys: collectPartialLineKeysFromCoverage(orderHints?.lineCoverageByKey),
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
    if (!openEntries.length) return null;
  }

  return (
    <ZkWatchModalSection title={ZK_MODAL_SECTION_TITLES.prosba} hint={ZK_MODAL_SECTION_HINTS.prosba}>
      {openEntries.length > 0 ? (
        <ul className="space-y-2">
          {openEntries.map((entry) => (
            <li
              key={entry.order.id}
              className="rounded-lg border border-slate-200/90 bg-white px-3 py-2.5 shadow-[var(--shadow-card)]"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <p className={cn(salesTypography.rowBody, "font-medium text-slate-800")}>
                    {entry.productLabel}
                  </p>
                  <div className="mt-1 flex min-w-0 flex-wrap items-center gap-1.5">
                    <Badge variant="info" className="shrink-0 text-[10px]">
                      {entry.statusLabel}
                    </Badge>
                    <span
                      className={cn(
                        salesTypography.rowMeta,
                        "min-w-0 max-w-full line-clamp-2 leading-snug"
                      )}
                      title={formatZkProsbaPreviewMetaTooltip(entry)}
                    >
                      {formatZkProsbaPreviewMetaLine(entry)}
                    </span>
                  </div>
                </div>
                <div className="flex shrink-0 flex-wrap gap-1.5">
                  <Link
                    href={mojeFocusHref(entry.order.id)}
                    title={ZK_MODAL_PROSBA_COPY.previewLinkTitle}
                    className={cn(
                      "inline-flex cursor-pointer items-center justify-center gap-2 font-medium transition-colors",
                      "border border-[var(--card-border)] bg-[var(--card)] text-slate-700 shadow-sm hover:bg-slate-50",
                      "rounded-md px-2.5 py-1.5 text-xs leading-none"
                    )}
                  >
                    Podgląd
                  </Link>
                </div>
              </div>
            </li>
          ))}
        </ul>
      ) : prosbaCardAction.kind === "covered" ? (
        <div className="rounded-lg border border-emerald-200/80 bg-emerald-50/60 px-3 py-2.5 text-sm text-emerald-950">
          <p className="font-medium">{ZK_MODAL_PROSBA_COPY.coveredTitle}</p>
        </div>
      ) : !archived ? (
        <div className="rounded-lg border border-slate-200/90 bg-slate-50/60 px-3 py-2.5">
          <p className={cn(salesTypography.rowBody, "font-medium text-slate-800")}>
            {ZK_MODAL_PROSBA_COPY.emptyTitle}
          </p>
          <p className={cn("mt-1", salesTypography.rowMeta, "text-slate-600")}>
            {ZK_MODAL_PROSBA_COPY.emptyHintPrefix}{" "}
            <span className="font-medium">{ZK_MODAL_PROSBA_COPY.createProsbaAction}</span> lub{" "}
            <span className="font-medium">{ZK_MODAL_PROSBA_COPY.supplementAction}</span>.
          </p>
        </div>
      ) : (
        <p className={cn(salesTypography.rowMeta, "text-slate-500")}>
          {ZK_MODAL_PROSBA_COPY.archivedEmpty}
        </p>
      )}
    </ZkWatchModalSection>
  );
}
