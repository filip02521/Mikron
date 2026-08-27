"use client";

import { IconSun } from "@/components/icons/StrokeIcons";
import {
  PageAttentionStrip,
  PageAttentionStripCta,
} from "@/components/ui/PageAttentionStrip";
import {
  dailyPanelVacationNoticeCtaLabel,
  dailyPanelVacationNoticeHint,
  dailyPanelVacationNoticeTitle,
} from "@/lib/orders/daily-panel-vacation-notice-copy";

/**
 * Komunikat: dostawcy na urlopie w kolejce zaległe / na dziś.
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

  return (
    <PageAttentionStrip
      tone="amber"
      edge="inset"
      density={density}
      className={className}
      icon={
        <IconSun size={density === "compact" ? 15 : 17} strokeWidth={2.25} />
      }
      title={dailyPanelVacationNoticeTitle(count)}
      hint={dailyPanelVacationNoticeHint()}
      actions={
        <PageAttentionStripCta href={vacationsHref} density={density}>
          {dailyPanelVacationNoticeCtaLabel()}
        </PageAttentionStripCta>
      }
    />
  );
}
