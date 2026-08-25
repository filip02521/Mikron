"use client";

import { IconChevronDown } from "@/components/icons/StrokeIcons";
import { cn } from "@/lib/cn";
import { PROCUREMENT_REQUEST_LANE_COPY } from "@/lib/orders/procurement-request-lane-copy";
import {
  isProcurementSystemLaneId,
  type ProcurementRequestLaneId,
} from "@/lib/orders/procurement-request-lanes";
import {
  dailyPanelUnseenBadgeClass,
} from "@/lib/ui/ontime-theme";
import {
  procurementRequestLaneCountPillClass,
  procurementRequestLaneDotClass,
  procurementRequestLaneHeaderClass,
  resolveProcurementRequestLaneTone,
  type ProcurementRequestLaneTone,
} from "@/lib/ui/procurement-request-lane-ui";

export function procurementRequestLaneHint(
  laneId: ProcurementRequestLaneId
): string | null {
  if (!isProcurementSystemLaneId(laneId)) return null;
  switch (laneId) {
    case "triage":
      return PROCUREMENT_REQUEST_LANE_COPY.triageHint;
    case "do_zamowienia":
      return PROCUREMENT_REQUEST_LANE_COPY.doZamowieniaHint;
    case "magazyn_info":
      return PROCUREMENT_REQUEST_LANE_COPY.magazynInfoHint;
    case "urlop":
      return PROCUREMENT_REQUEST_LANE_COPY.urlopHint;
    default:
      return null;
  }
}

export function ProcurementRequestLaneHeader({
  label,
  count,
  countLabel,
  collapsed,
  tone,
  hint,
  collapsedHint,
  peekUnseenCount = 0,
  onToggle,
  canMoveUp = false,
  canMoveDown = false,
  movePending = false,
  onMoveUp,
  onMoveDown,
}: {
  label: string;
  /** Liczba całkowita w torze (aria / fallback). */
  count: number;
  /** Widoczna etykieta licznika (`3` albo `1/5`). */
  countLabel?: string;
  collapsed: boolean;
  tone: ProcurementRequestLaneTone;
  /** Krótki podtytuł kontekstu — tylko gdy rozwinięty i jest treść. */
  hint?: string | null;
  /** Podtytuł przy zwiniętym torze (np. „tylko nowe”). */
  collapsedHint?: string | null;
  /** Ile nowych w podglądzie zwiniętego toru (badge). */
  peekUnseenCount?: number;
  onToggle: () => void;
  canMoveUp?: boolean;
  canMoveDown?: boolean;
  movePending?: boolean;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
}) {
  const resolvedTone = resolveProcurementRequestLaneTone(tone);
  const showMove = Boolean(onMoveUp || onMoveDown);
  const expandedHintText = hint?.trim() || null;
  const collapsedHintText = collapsedHint?.trim() || null;
  const subtitle = collapsed ? collapsedHintText : expandedHintText;
  const visibleCount = (countLabel ?? String(count)).trim() || String(count);
  const showPeekBadge = collapsed && peekUnseenCount > 0;

  return (
    <div
      className={cn(
        procurementRequestLaneHeaderClass(resolvedTone, collapsed),
        "gap-0 p-0"
      )}
    >
      <button
        type="button"
        className="flex min-w-0 flex-1 items-center gap-2 px-2.5 py-2 text-left sm:px-3"
        onClick={onToggle}
        aria-expanded={!collapsed}
        aria-label={
          collapsed
            ? `${label}, ${count}, ${PROCUREMENT_REQUEST_LANE_COPY.laneExpand}`
            : `${label}, ${count}, ${PROCUREMENT_REQUEST_LANE_COPY.laneCollapse}`
        }
      >
        <IconChevronDown
          size={14}
          open={!collapsed}
          className="shrink-0 text-slate-400 transition-transform duration-200 ease-out motion-reduce:transition-none"
        />
        <span className={procurementRequestLaneDotClass(resolvedTone)} aria-hidden />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[12px] font-semibold tracking-tight text-slate-800">
            {label}
          </span>
          {subtitle ? (
            <span className="mt-0.5 block truncate text-[10px] font-medium leading-snug text-slate-500">
              {subtitle}
            </span>
          ) : null}
        </span>
        {showPeekBadge ? (
          <span
            className={cn(
              "shrink-0 rounded px-1.5 py-0.5 text-[10px] font-bold tabular-nums",
              dailyPanelUnseenBadgeClass("prosby")
            )}
          >
            {peekUnseenCount}{" "}
            {peekUnseenCount === 1
              ? "nowa"
              : peekUnseenCount >= 2 && peekUnseenCount <= 4
                ? "nowe"
                : "nowych"}
          </span>
        ) : null}
        <span className={cn(procurementRequestLaneCountPillClass(resolvedTone))}>
          {visibleCount}
        </span>
      </button>
      {showMove ? (
        <div className="flex shrink-0 flex-col justify-center gap-0.5 border-l border-black/5 px-1 py-1">
          <button
            type="button"
            className="rounded px-1.5 py-0.5 text-[10px] font-semibold text-slate-500 transition-colors hover:bg-white/70 hover:text-slate-800 disabled:opacity-35"
            disabled={movePending || !canMoveUp}
            title={PROCUREMENT_REQUEST_LANE_COPY.laneMoveUp}
            aria-label={`${PROCUREMENT_REQUEST_LANE_COPY.laneMoveUp}: ${label}`}
            onClick={() => onMoveUp?.()}
          >
            ↑
          </button>
          <button
            type="button"
            className="rounded px-1.5 py-0.5 text-[10px] font-semibold text-slate-500 transition-colors hover:bg-white/70 hover:text-slate-800 disabled:opacity-35"
            disabled={movePending || !canMoveDown}
            title={PROCUREMENT_REQUEST_LANE_COPY.laneMoveDown}
            aria-label={`${PROCUREMENT_REQUEST_LANE_COPY.laneMoveDown}: ${label}`}
            onClick={() => onMoveDown?.()}
          >
            ↓
          </button>
        </div>
      ) : null}
    </div>
  );
}
