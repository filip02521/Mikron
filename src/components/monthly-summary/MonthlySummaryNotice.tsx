"use client";

import { useMemo } from "react";
import {
  PageAttentionStrip,
  PageAttentionStripCta,
} from "@/components/ui/PageAttentionStrip";
import {
  defaultMonthlySummaryMonthKey,
  monthLabelFromKey,
} from "@/lib/data/monthly-stats-shared";
import {
  markMonthlySummarySeen,
  MONTHLY_SUMMARY_HREF,
} from "@/lib/monthly-summary-attention";
import { useMonthlySummaryNeedsAttention } from "@/hooks/useMonthlySummaryAttention";

function MonthlyChartIcon({ size = 14 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M3 3v18h18" />
      <path d="M7 14l4-4 3 3 5-5" />
    </svg>
  );
}

function DismissIcon({ size = 14 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M18 6L6 18M6 6l12 12" />
    </svg>
  );
}

export function MonthlySummaryNotice() {
  const monthKey = useMemo(() => defaultMonthlySummaryMonthKey(), []);
  const monthLabel = useMemo(() => monthLabelFromKey(monthKey), [monthKey]);
  const needsAttention = useMonthlySummaryNeedsAttention();

  if (!needsAttention) return null;

  return (
    <PageAttentionStrip
      tone="violet"
      edge="inset"
      icon={<MonthlyChartIcon size={15} />}
      title={`Podsumowanie za ${monthLabel}`}
      hint="Statystyki zespołu są gotowe do przejrzenia"
      actions={
        <>
          <PageAttentionStripCta
            tone="violet"
            href={MONTHLY_SUMMARY_HREF}
            onClick={() => markMonthlySummarySeen(monthKey)}
          >
            Zobacz
          </PageAttentionStripCta>
          <button
            type="button"
            onClick={() => markMonthlySummarySeen(monthKey)}
            aria-label="Zamknij powiadomienie"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-violet-200/80 bg-white/90 text-violet-500 transition hover:bg-violet-50 hover:text-violet-800"
          >
            <DismissIcon />
          </button>
        </>
      }
    />
  );
}
