import { formatSalesTrackReviewBadge } from "@/lib/orders/zd-estimate-sales-track";
import type { SalesTrackReason } from "@/lib/orders/zd-estimate-sales-track";

export type ZdEstimateConfidenceTone = "idle" | "ok" | "review" | "accepted";

export type ZdEstimateConfidenceUi = {
  hasSignal: boolean;
  needsReview: boolean;
  tone: ZdEstimateConfidenceTone;
  pct: number;
  title: string;
  acceptAriaLabel: string;
  reason: string | null;
};

export function zdEstimateConfidencePct(confidence: number): number {
  return Math.round(
    Math.max(0, Math.min(1, Number(confidence) || 0)) * 100
  );
}

/**
 * Prezentacja pewności pod Do ZD (whisper) — title / tone / pct.
 * Bez JSX — testowalne.
 */
export function buildZdEstimateConfidenceUi(input: {
  confidence: number;
  qtyReview: boolean;
  reasons: readonly SalesTrackReason[];
  accepted?: boolean;
  detailHint?: string;
  canAccept?: boolean;
}): ZdEstimateConfidenceUi {
  const accepted = Boolean(input.accepted);
  const hasSignal =
    input.confidence > 1e-9 || input.qtyReview || accepted;
  const needsReview = input.qtyReview && !accepted;
  const pct = zdEstimateConfidencePct(input.confidence);
  const badge = formatSalesTrackReviewBadge({
    qtyReview: needsReview,
    confidence: input.confidence,
    reasons: input.reasons,
  });

  const titleBits = [
    needsReview
      ? "Do weryfikacji"
      : accepted
        ? "Zaakceptowano w tej sesji"
        : null,
    badge?.reason,
    needsReview && input.canAccept ? "Kliknij, żeby zaakceptować" : null,
  ].filter(Boolean) as string[];

  if (input.detailHint) {
    const compact = input.detailHint
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

  const tone: ZdEstimateConfidenceTone = !hasSignal
    ? "idle"
    : needsReview
      ? "review"
      : accepted
        ? "accepted"
        : "ok";

  return {
    hasSignal,
    needsReview,
    tone,
    pct,
    title: titleBits.join(" · "),
    acceptAriaLabel: badge?.reason
      ? `Zaakceptuj weryfikację: ${pct}%, ${badge.reason}`
      : `Zaakceptuj weryfikację: ${pct}%`,
    reason: badge?.reason ?? null,
  };
}

/**
 * Druga linia Do ZD: override > roundup > confidence whisper > pieces.
 * Gdy override/roundup — whisper tylko w title (nie zajmuje linii).
 */
export type ZdEstimateDoZdHintKind =
  | "override"
  | "roundup"
  | "confidence"
  | "pieces"
  | null;

export function resolveZdEstimateDoZdHintKind(input: {
  overridden: boolean;
  hasRoundup: boolean;
  showConfidenceWhisper: boolean;
  hasPiecesSubline: boolean;
}): ZdEstimateDoZdHintKind {
  if (input.overridden) return "override";
  if (input.hasRoundup) return "roundup";
  if (input.showConfidenceWhisper) return "confidence";
  if (input.hasPiecesSubline) return "pieces";
  return null;
}
