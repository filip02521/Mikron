"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { Badge } from "@/components/ui/Badge";
import { SectionHeadingIcon } from "@/components/icons/SectionHeadingIcon";
import { IconChevronDown } from "@/components/icons/StrokeIcons";
import { mojeShipmentSectionShellClass } from "@/lib/ui/moje-shipment-row-styles";
import { panelTypography, salesTypography, sectionIconTileBrandClass } from "@/lib/ui/ontime-theme";

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
  tileClassName = sectionIconTileBrandClass,
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
  tileClassName?: string;
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
        mojeShipmentSectionShellClass,
        highlight && !open && "ring-1 ring-amber-200/90",
        className
      )}
    >
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="flex w-full items-start justify-between gap-2 border-b border-indigo-100/70 bg-gradient-to-r from-indigo-50/25 via-white to-white px-3 py-2 text-left transition hover:from-indigo-50/40 sm:px-4"
      >
        <div className="flex min-w-0 flex-1 items-start gap-2.5">
          <SectionHeadingIcon tileClassName={tileClassName}>{icon}</SectionHeadingIcon>
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
            <span className="rounded-full bg-indigo-100/90 px-2 py-0.5 text-[11px] font-semibold tabular-nums text-indigo-900">
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
