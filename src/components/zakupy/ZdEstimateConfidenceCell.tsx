"use client";

import { formatSalesTrackReviewBadge } from "@/lib/orders/zd-estimate-sales-track";
import type { SalesTrackReason } from "@/lib/orders/zd-estimate-sales-track";
import { cn } from "@/lib/cn";

function confidencePct(confidence: number): number {
  return Math.round(
    Math.max(0, Math.min(1, Number(confidence) || 0)) * 100
  );
}

/**
 * Jedyna widoczna powierzchnia pewności / weryfikacji w wierszu.
 * Powód i szczegóły w tooltipie; klik = akceptacja sesyjna (bez badge pod nazwą).
 */
export function ZdEstimateConfidenceCell({
  confidence,
  qtyReview,
  reasons,
  accepted = false,
  detailHint,
  onAccept,
}: {
  confidence: number;
  qtyReview: boolean;
  reasons: readonly SalesTrackReason[];
  accepted?: boolean;
  /** Pełny hint z formatSalesTrackHint (delta, hold, itd.). */
  detailHint?: string;
  onAccept?: () => void;
}) {
  const hasSignal = confidence > 1e-9 || qtyReview || accepted;
  if (!hasSignal) {
    return <span className="text-slate-300">—</span>;
  }

  const pct = confidencePct(confidence);
  const needsReview = qtyReview && !accepted;
  const badge = formatSalesTrackReviewBadge({
    qtyReview: needsReview,
    confidence,
    reasons,
  });

  const titleBits = [
    needsReview ? "Do weryfikacji" : accepted ? "Zaakceptowano w tej sesji" : null,
    badge?.reason,
    needsReview && onAccept ? "Kliknij, żeby zaakceptować" : null,
  ].filter(Boolean) as string[];

  // detailHint tylko gdy wnosi coś poza pewnością / „sprawdź”
  if (detailHint) {
    const compact = detailHint
      .replace(/\s*·?\s*pewność\s+\d+%\s*—\s*sprawdź/gi, "")
      .replace(/\s*pewność\s+\d+%/gi, "")
      .replace(/\s*—\s*sprawdź/gi, "")
      .replace(/\s{2,}/g, " ")
      .replace(/^[·\s]+|[·\s]+$/g, "")
      .trim();
    if (
      compact &&
      !titleBits.some(
        (b) =>
          b.toLowerCase() === compact.toLowerCase() ||
          compact.toLowerCase().includes(b.toLowerCase())
      )
    ) {
      titleBits.push(compact);
    }
  }

  const title = titleBits.join(" · ");

  const body = (
    <span
      className={cn(
        "inline-flex items-center justify-end gap-1 tabular-nums tracking-tight",
        needsReview && "font-semibold text-amber-800",
        accepted && "font-medium text-emerald-700",
        !needsReview && !accepted && "font-medium text-slate-500"
      )}
    >
      <span>{pct}%</span>
      {needsReview ? (
        <span
          className="size-1.5 shrink-0 rounded-full bg-amber-500"
          aria-hidden
        />
      ) : accepted ? (
        <span
          className="text-[9px] font-semibold uppercase tracking-wide text-emerald-600/90"
          aria-hidden
        >
          ok
        </span>
      ) : null}
    </span>
  );

  if (needsReview && onAccept) {
    return (
      <button
        type="button"
        onClick={onAccept}
        title={title}
        aria-label={
          badge?.reason
            ? `Zaakceptuj weryfikację: ${pct}%, ${badge.reason}`
            : `Zaakceptuj weryfikację: ${pct}%`
        }
        className={cn(
          "inline-flex max-w-full rounded-md px-1 py-0.5 -mx-1",
          "transition hover:bg-amber-50 focus-visible:outline focus-visible:outline-2",
          "focus-visible:outline-offset-1 focus-visible:outline-amber-500/60"
        )}
      >
        {body}
      </button>
    );
  }

  return (
    <span className="inline-flex max-w-full" title={title || undefined}>
      {body}
    </span>
  );
}
