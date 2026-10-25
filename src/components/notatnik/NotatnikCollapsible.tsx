"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { IconChevronDown } from "@/components/icons/StrokeIcons";
import { panelTypography, salesTypography } from "@/lib/ui/ontime-theme";

export function NotatnikCollapsible({
  title,
  description,
  count,
  open,
  onToggle,
  children,
  className,
  highlight,
  badge,
  icon,
  domain = "sales",
}: {
  title: string;
  description?: string;
  count?: number;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
  className?: string;
  highlight?: boolean;
  badge?: ReactNode;
  icon: ReactNode;
  domain?: "sales" | "panel";
}) {
  const titleClass =
    domain === "panel"
      ? cn(panelTypography.sectionLabel, "text-indigo-900/90")
      : cn(salesTypography.sectionLabel, "text-indigo-900/90");
  const hintClass =
    domain === "panel"
      ? cn("mt-0.5", panelTypography.sectionDesc, "text-indigo-800/75")
      : cn("mt-0.5", salesTypography.sectionHint, "text-indigo-800/75");

  return (
    <section
      className={cn(
        "bg-white",
        highlight && !open && "bg-amber-50/40",
        className
      )}
    >
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="flex w-full items-start justify-between gap-2 border-b border-indigo-100/70 bg-indigo-50/25 px-3 py-2 text-left transition hover:bg-indigo-50/40 sm:px-4"
      >
        <div className="flex min-w-0 flex-1 items-start gap-2.5">
          <span className="mt-0.5 shrink-0 text-slate-500" aria-hidden>
            {icon}
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className={titleClass}>
                {title}
              </h3>
              {badge && !open ? badge : null}
            </div>
            {description ? (
              <p className={hintClass}>
                {description}
              </p>
            ) : null}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2 pt-0.5">
          {count !== undefined && count > 0 ? (
            <span className="rounded-md bg-indigo-100/90 px-2 py-0.5 text-[0.6875rem] font-semibold tabular-nums text-indigo-900">
              {count}
            </span>
          ) : null}
          <IconChevronDown open={open} className="text-slate-400" size={18} />
        </div>
      </button>
      {open ? <div className="p-3 sm:p-4">{children}</div> : null}
    </section>
  );
}
