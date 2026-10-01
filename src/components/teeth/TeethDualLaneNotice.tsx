"use client";

import Link from "next/link";
import type { TeethSupplierLaneSnapshot } from "@/lib/data/teeth-schedule-shared";
import {
  describeTeethLaneForDailyPanel,
  TEETH_DUAL_LANE_COPY,
  teethSupplierCardsHref,
} from "@/lib/teeth/teeth-supplier-dual-lane";
import { brandLinkClass } from "@/lib/ui/ontime-theme";
import { cn } from "@/lib/cn";

export function TeethDualLaneNotice({
  lane,
  className,
}: {
  lane: TeethSupplierLaneSnapshot;
  className?: string;
}) {
  const copy = describeTeethLaneForDailyPanel(lane);

  return (
    <div
      className={cn(
        "mt-4 rounded-md border border-neutral-200 bg-neutral-50 px-3 py-3 text-sm text-neutral-900",
        className
      )}
      role="note"
    >
      <p className="font-semibold text-neutral-900">{TEETH_DUAL_LANE_COPY.dailyPanelNoticeTitle}</p>
      <p className="mt-1 text-[13px] leading-snug text-neutral-900">
        {TEETH_DUAL_LANE_COPY.dailyPanelNoticeBody}
      </p>
      <p className="mt-2 font-medium text-neutral-900">{copy.primary}</p>
      {copy.secondary ? (
        <p className="mt-0.5 text-xs text-neutral-800">{copy.secondary}</p>
      ) : null}
      <p className="mt-2 text-xs">
        <Link href={teethSupplierCardsHref()} className={brandLinkClass}>
          Cykl zębów w kartach dostawców →
        </Link>
      </p>
    </div>
  );
}
