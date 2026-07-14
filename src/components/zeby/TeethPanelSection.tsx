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
  className,
}: {
  title: string;
  hint?: string;
  icon?: ReactNode;
  iconTileClassName?: string;
  children: ReactNode;
  headerAside?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "overflow-hidden rounded-md border border-slate-200/80 bg-[var(--card)] shadow-sm",
        className,
      )}
    >
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
  tone = "emerald",
  action,
}: {
  title: string;
  description?: string;
  icon: ReactNode;
  tone?: "emerald" | "sky" | "amber";
  action?: ReactNode;
}) {
  const iconShellClass =
    tone === "sky"
      ? "bg-sky-50 text-sky-700"
      : tone === "amber"
        ? "bg-amber-50 text-amber-800"
        : "bg-emerald-50 text-emerald-700";

  return (
    <div className="overflow-hidden rounded-md border border-slate-200/80 bg-[var(--card)] shadow-sm">
      <div className={cn("py-8 text-center", panelSectionInsetClass)}>
        <div
          className={cn(
            "mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full",
            iconShellClass,
          )}
        >
          {icon}
        </div>
        <p className={panelTypography.rowTitle}>{title}</p>
        {description ? (
          <p className={cn(panelTypography.caption, "mx-auto mt-1.5 max-w-md")}>{description}</p>
        ) : null}
        {action ? <div className="mt-4">{action}</div> : null}
      </div>
    </div>
  );
}

export function TeethPanelListSkeleton({ groups = 3 }: { groups?: number }) {
  return (
    <div className="space-y-3" aria-busy="true" aria-label="Ładowanie listy">
      {Array.from({ length: groups }).map((_, index) => (
        <div
          key={index}
          className="overflow-hidden rounded-md border border-slate-200/80 bg-[var(--card)] shadow-sm motion-safe:animate-pulse"
        >
          <div className="border-b border-slate-100 px-4 py-3">
            <div className="h-4 w-40 rounded bg-slate-200" />
            <div className="mt-2 h-3 w-24 rounded bg-slate-100" />
          </div>
          <div className="space-y-2 px-4 py-3">
            <div className="h-10 rounded bg-slate-100" />
            <div className="h-10 rounded bg-slate-100" />
          </div>
        </div>
      ))}
    </div>
  );
}
