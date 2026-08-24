"use client";

import Link from "next/link";
import { IconSun } from "@/components/icons/StrokeIcons";
import { LinkChevron } from "@/components/ui/UiGlyphs";
import { cn } from "@/lib/cn";
import {
  dailyPanelVacationNoticeCtaLabel,
  dailyPanelVacationNoticeHint,
  dailyPanelVacationNoticeTitle,
} from "@/lib/orders/daily-panel-vacation-notice-copy";

/** Jak banery weryfikacji / tablicy — płaski amber, bez cienia karty. */
const shellClass =
  "flex flex-wrap items-center justify-between gap-3 rounded-md border border-amber-200/70 bg-amber-50/80 px-3 py-2.5 sm:px-4";

/**
 * Komunikat: dostawcy na urlopie w kolejce zaległe / na dziś.
 * Spójny z {@link DailyPanelVerificationBanner} i {@link DailyPanelBoardQuestionsBanner}.
 */
export function DailyPanelVacationNotice({
  count,
  vacationsHref,
  className,
  density = "comfortable",
}: {
  count: number;
  vacationsHref: string;
  className?: string;
  /** `compact` — węższy pasek w status bandzie pod postępem dnia. */
  density?: "comfortable" | "compact";
}) {
  if (count <= 0) return null;

  const title = dailyPanelVacationNoticeTitle(count);
  const hint = dailyPanelVacationNoticeHint();
  const cta = dailyPanelVacationNoticeCtaLabel();
  const compact = density === "compact";

  return (
    <div
      className={cn(
        shellClass,
        compact && "gap-2 px-2.5 py-2 sm:px-3",
        className
      )}
      role="status"
    >
      <div className="flex min-w-0 items-start gap-2.5">
        <span
          className={cn(
            "mt-0.5 flex shrink-0 items-center justify-center rounded-md bg-amber-100 text-amber-800",
            compact ? "h-7 w-7" : "h-8 w-8"
          )}
          aria-hidden
        >
          <IconSun size={compact ? 15 : 17} strokeWidth={2.25} />
        </span>
        <p
          className={cn(
            "min-w-0 leading-snug text-slate-800",
            compact ? "text-xs sm:text-sm" : "text-sm"
          )}
        >
          <span className="font-semibold text-amber-950">{title}</span>
          <span className="text-slate-600"> — {hint}</span>
        </p>
      </div>
      <Link
        href={vacationsHref}
        className={cn(
          "inline-flex shrink-0 items-center gap-1 rounded-md border border-amber-200/90 bg-white px-2.5 text-xs font-medium text-amber-950 transition hover:bg-amber-50",
          compact ? "h-7" : "h-8"
        )}
      >
        {cta}
        <LinkChevron size={13} tone="muted" />
      </Link>
    </div>
  );
}
