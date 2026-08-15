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
 * Pewność w wierszu — kompaktowy pill (jak Status).
 * Klik przy review = akceptacja sesyjna.
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
  detailHint?: string;
  onAccept?: () => void;
}) {
  const hasSignal = confidence > 1e-9 || qtyReview || accepted;
  if (!hasSignal) {
    return (
      <span className="zd-est-confidence zd-est-confidence--idle" title="Brak sygnału pewności">
        —
      </span>
    );
  }

  const pct = confidencePct(confidence);
  const needsReview = qtyReview && !accepted;
  const badge = formatSalesTrackReviewBadge({
    qtyReview: needsReview,
    confidence,
    reasons,
  });

  const titleBits = [
    needsReview
      ? "Do weryfikacji"
      : accepted
        ? "Zaakceptowano w tej sesji"
        : null,
    badge?.reason,
    needsReview && onAccept ? "Kliknij, żeby zaakceptować" : null,
  ].filter(Boolean) as string[];

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
  const toneClass = needsReview
    ? "zd-est-confidence--review"
    : accepted
      ? "zd-est-confidence--accepted"
      : "zd-est-confidence--ok";

  const body = (
    <>
      <span>{pct}%</span>
      {needsReview ? (
        <span className="zd-est-confidence__dot" aria-hidden />
      ) : null}
    </>
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
        className={cn("zd-est-confidence", toneClass)}
      >
        {body}
      </button>
    );
  }

  return (
    <span className={cn("zd-est-confidence", toneClass)} title={title || undefined}>
      {body}
    </span>
  );
}
