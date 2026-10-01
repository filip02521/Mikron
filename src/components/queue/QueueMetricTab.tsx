"use client";

import { SectionHeadingIcon } from "@/components/icons/SectionHeadingIcon";
import { cn } from "@/lib/cn";
import {
  panelMetricTileClass,
  panelMetricTileInteractiveClass,
  panelTypography,
} from "@/lib/ui/ontime-theme";

export function QueueMetricTab({
  active,
  count,
  label,
  hint,
  icon,
  tileClassName,
  title,
  onClick,
  disabled = false,
  accent = "emerald",
  id,
  ariaControls,
}: {
  active: boolean;
  count: number;
  label: string;
  hint?: string;
  icon: React.ReactNode;
  tileClassName: string;
  title?: string;
  onClick?: () => void;
  disabled?: boolean;
  accent?: "emerald" | "indigo";
  id?: string;
  ariaControls?: string;
}) {
  const activeRing =
    accent === "emerald"
      ? "border-emerald-300/90 ring-2 ring-emerald-500/20"
      : "border-indigo-300/90 ring-2 ring-indigo-500/15";

  const className = cn(
    panelMetricTileClass,
    "px-2.5 py-2 text-left transition sm:px-3 sm:py-2.5",
    onClick && !disabled && panelMetricTileInteractiveClass,
    active
      ? cn("bg-white shadow-[var(--shadow-card-elevated)]", activeRing)
      : onClick && !disabled
        ? "opacity-90 hover:opacity-100"
        : "border-slate-200/90 bg-white/80",
    disabled && "cursor-default opacity-60"
  );

  const inner = (
    <>
      <SectionHeadingIcon
        tileClassName={tileClassName}
        className="mb-1.5 h-6 w-6 sm:mb-2 sm:h-7 sm:w-7"
      >
        {icon}
      </SectionHeadingIcon>
      <p className={cn(panelTypography.statValue, "text-lg sm:text-xl")}>{count}</p>
      <p className="mt-0.5 text-[11px] font-medium text-slate-700 sm:text-xs">{label}</p>
      {hint ? (
        <p className="mt-0.5 line-clamp-2 text-[10px] leading-snug text-slate-500">{hint}</p>
      ) : null}
    </>
  );

  if (onClick) {
    return (
      <button
        type="button"
        id={id}
        role="tab"
        aria-selected={active}
        aria-controls={ariaControls}
        aria-disabled={disabled || undefined}
        disabled={disabled}
        title={title ?? label}
        onClick={onClick}
        className={className}
      >
        {inner}
      </button>
    );
  }

  return (
    <div className={className} title={title ?? label} role="tab" aria-selected={active}>
      {inner}
    </div>
  );
}
