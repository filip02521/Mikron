"use client";

import { IconChevronDown } from "@/components/icons/StrokeIcons";
import { cn } from "@/lib/cn";
import { PROCUREMENT_REQUEST_LANE_COPY } from "@/lib/orders/procurement-request-lane-copy";
import {
  isProcurementSystemLaneId,
  type ProcurementRequestLaneId,
} from "@/lib/orders/procurement-request-lanes";
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
  collapsed,
  tone,
  hint,
  onToggle,
  canMoveUp = false,
  canMoveDown = false,
  movePending = false,
  onMoveUp,
  onMoveDown,
}: {
  label: string;
  count: number;
  collapsed: boolean;
  tone: ProcurementRequestLaneTone;
  /** Krótki podtytuł kontekstu — tylko gdy rozwinięty i jest treść. */
  hint?: string | null;
  onToggle: () => void;
  canMoveUp?: boolean;
  canMoveDown?: boolean;
  movePending?: boolean;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
}) {
  const resolvedTone = resolveProcurementRequestLaneTone(tone);
  const showMove = Boolean(onMoveUp || onMoveDown);

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
      >
        <IconChevronDown
          size={14}
          open={!collapsed}
          className="shrink-0 text-slate-400 transition-transform"
        />
        <span className={procurementRequestLaneDotClass(resolvedTone)} aria-hidden />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[12px] font-semibold tracking-tight text-slate-800">
            {label}
          </span>
          {!collapsed && hint ? (
            <span className="mt-0.5 block truncate text-[10px] font-medium leading-snug text-slate-500">
              {hint}
            </span>
          ) : null}
        </span>
        <span className={cn(procurementRequestLaneCountPillClass(resolvedTone))}>
          {count}
        </span>
        <span className="sr-only">
          {collapsed
            ? PROCUREMENT_REQUEST_LANE_COPY.laneExpand
            : PROCUREMENT_REQUEST_LANE_COPY.laneCollapse}
        </span>
      </button>
      {showMove ? (
        <div className="flex shrink-0 flex-col justify-center gap-0.5 border-l border-black/5 px-1 py-1">
          <button
            type="button"
            className="rounded px-1.5 py-0.5 text-[10px] font-semibold text-slate-500 hover:bg-white/70 hover:text-slate-800 disabled:opacity-35"
            disabled={movePending || !canMoveUp}
            title={PROCUREMENT_REQUEST_LANE_COPY.laneMoveUp}
            aria-label={`${PROCUREMENT_REQUEST_LANE_COPY.laneMoveUp}: ${label}`}
            onClick={() => onMoveUp?.()}
          >
            ↑
          </button>
          <button
            type="button"
            className="rounded px-1.5 py-0.5 text-[10px] font-semibold text-slate-500 hover:bg-white/70 hover:text-slate-800 disabled:opacity-35"
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
