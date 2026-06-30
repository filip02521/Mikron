"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { panelSectionInsetClass, panelSubsectionInsetClass, panelTypography } from "@/lib/ui/ontime-theme";
import { CardHeader } from "@/components/ui/Card";
import { SectionHeadingIcon } from "@/components/icons/SectionHeadingIcon";

/** Karta sekcji wewnątrz panelu zębów — spójna z panelem dziennym. */
export function TeethPanelSection({
  title,
  hint,
  icon,
  iconTileClassName = "bg-emerald-100 text-emerald-800",
  children,
  headerAside,
}: {
  title: string;
  hint?: string;
  icon?: ReactNode;
  iconTileClassName?: string;
  children: ReactNode;
  headerAside?: ReactNode;
}) {
  return (
    <div className="overflow-hidden rounded-md border border-slate-200/80 bg-[var(--card)] shadow-sm">
      <CardHeader
        inset
        density="compact"
        leading={
          icon ? (
            <SectionHeadingIcon tileClassName={iconTileClassName}>{icon}</SectionHeadingIcon>
          ) : undefined
        }
        title={title}
        hint={hint}
        action={headerAside}
      />
      <div className={cn(panelSubsectionInsetClass, "py-3")}>{children}</div>
    </div>
  );
}

export function TeethPanelTabPanel({
  id,
  labelledBy,
  children,
  className,
}: {
  id: string;
  labelledBy: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      id={id}
      role="tabpanel"
      aria-labelledby={labelledBy}
      className={cn(panelSectionInsetClass, "space-y-3 pb-4 pt-3", className)}
    >
      {children}
    </div>
  );
}

export function TeethPanelEmpty({
  title,
  description,
  icon,
}: {
  title: string;
  description?: string;
  icon: ReactNode;
}) {
  return (
    <div className="overflow-hidden rounded-md border border-slate-200/80 bg-[var(--card)] shadow-sm">
      <div className={cn("py-8 text-center", panelSectionInsetClass)}>
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50 text-emerald-700">
          {icon}
        </div>
        <p className={panelTypography.rowTitle}>{title}</p>
        {description ? (
          <p className={cn(panelTypography.caption, "mx-auto mt-1.5 max-w-md")}>{description}</p>
        ) : null}
      </div>
    </div>
  );
}
