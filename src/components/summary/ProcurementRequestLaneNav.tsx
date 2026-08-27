"use client";

import { cn } from "@/lib/cn";
import type { ProcurementRequestLaneId } from "@/lib/orders/procurement-request-lanes";
import { PROCUREMENT_REQUEST_LANE_COPY } from "@/lib/orders/procurement-request-lane-copy";
import {
  procurementListFilterBarClass,
  procurementListFilterChipClass,
  procurementListFilterCountClass,
  procurementListFilterTrackClass,
  procurementListFilterTrackFadeClass,
} from "@/lib/ui/procurement-status-chips";
import {
  procurementRequestLaneNavChipClass,
  procurementRequestLaneNavCountClass,
  resolveProcurementRequestLaneTone,
  type ProcurementRequestLaneTone,
} from "@/lib/ui/procurement-request-lane-ui";
import { useEffect, useRef, useState } from "react";

export type ProcurementRequestLaneNavItem = {
  laneId: ProcurementRequestLaneId;
  anchorId: string;
  count: number;
  label: string;
  tone: ProcurementRequestLaneTone;
};

export function ProcurementRequestLaneNav({
  items,
  onManageClick,
  onLaneNavigate,
  className,
}: {
  items: ProcurementRequestLaneNavItem[];
  onManageClick?: () => void;
  /** Skok do sekcji (rodzic rozwija tor + scroll). */
  onLaneNavigate?: (laneId: ProcurementRequestLaneId, anchorId: string) => void;
  className?: string;
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [showScrollFade, setShowScrollFade] = useState(false);
  const visible = items.filter((i) => i.count > 0);

  useEffect(() => {
    const el = trackRef.current;
    if (!el) return;
    const updateFade = () => {
      const overflow = el.scrollWidth > el.clientWidth + 1;
      const notAtEnd = el.scrollLeft + el.clientWidth < el.scrollWidth - 2;
      setShowScrollFade(overflow && notAtEnd);
    };
    updateFade();
    el.addEventListener("scroll", updateFade, { passive: true });
    const ro =
      typeof ResizeObserver !== "undefined" ? new ResizeObserver(updateFade) : null;
    ro?.observe(el);
    return () => {
      el.removeEventListener("scroll", updateFade);
      ro?.disconnect();
    };
  }, [visible]);

  if (!visible.length && !onManageClick) return null;

  return (
    <div
      className={cn(procurementListFilterBarClass, className)}
      role="navigation"
      aria-label={PROCUREMENT_REQUEST_LANE_COPY.navLabel}
    >
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
        <div className="flex min-w-0 items-baseline gap-2">
          <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-400">
            {PROCUREMENT_REQUEST_LANE_COPY.navLabel}
          </p>
          {visible.length > 0 ? (
            <p className="truncate text-[10px] font-medium text-slate-400/90">
              skocz do sekcji
            </p>
          ) : null}
        </div>
        {onManageClick ? (
          <button
            type="button"
            className="shrink-0 rounded-md px-1.5 py-0.5 text-[11px] font-semibold text-indigo-700/90 transition-colors hover:bg-indigo-50 hover:text-indigo-950"
            onClick={onManageClick}
          >
            {PROCUREMENT_REQUEST_LANE_COPY.manageFlags}
          </button>
        ) : null}
      </div>
      {visible.length ? (
        <div className="relative mt-1">
          <div ref={trackRef} className={procurementListFilterTrackClass}>
            {visible.map((item) => {
              const tone = resolveProcurementRequestLaneTone(item.tone);
              return (
                <a
                  key={item.laneId}
                  href={`#${item.anchorId}`}
                  className={cn(
                    procurementListFilterChipClass,
                    procurementRequestLaneNavChipClass(tone)
                  )}
                  onClick={(e) => {
                    e.preventDefault();
                    if (onLaneNavigate) {
                      onLaneNavigate(item.laneId, item.anchorId);
                      return;
                    }
                    document
                      .getElementById(item.anchorId)
                      ?.scrollIntoView({ behavior: "smooth", block: "start" });
                  }}
                >
                  <span className="truncate">{item.label}</span>
                  <span
                    className={cn(
                      procurementListFilterCountClass,
                      "rounded px-1 py-px",
                      procurementRequestLaneNavCountClass(tone)
                    )}
                  >
                    {item.count}
                  </span>
                </a>
              );
            })}
          </div>
          {showScrollFade ? (
            <div className={procurementListFilterTrackFadeClass} aria-hidden />
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
