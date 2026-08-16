"use client";

import type { ReactNode } from "react";
import { ZdEstimateAlertBucket } from "@/components/zakupy/ZdEstimateAlertBucket";

/**
 * Pinned Create/Policz blockers — max `maxPrimary` pełnych alertów,
 * reszta w „Więcej problemów” (fill-viewport: nie zjada tabeli).
 */
export function ZdEstimatePinnedAlertStack({
  items,
  maxPrimary = 2,
  className = "flex shrink-0 flex-col gap-2",
}: {
  items: readonly ReactNode[];
  maxPrimary?: number;
  className?: string;
}) {
  const visible = items.filter(Boolean);
  if (visible.length === 0) return null;

  if (visible.length <= maxPrimary) {
    return <div className={className}>{visible}</div>;
  }

  return (
    <div className={className}>
      {visible.slice(0, maxPrimary)}
      <ZdEstimateAlertBucket
        title="Więcej problemów"
        defaultOpen={false}
        items={visible.slice(maxPrimary)}
      />
    </div>
  );
}
