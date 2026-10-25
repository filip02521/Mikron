"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { panelSectionInsetClass, panelSubsectionInsetClass } from "@/lib/ui/ontime-theme";
import { Card, CardHeader } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { SlowLoadingNote } from "@/components/ui/SlowLoadingNote";

/** Karta sekcji wewnątrz panelu zębów — spójna z panelem dziennym. */
export function TeethPanelSection({
  title,
  hint,
  children,
  headerAside,
  className,
}: {
  title: string;
  hint?: string;
  children: ReactNode;
  headerAside?: ReactNode;
  className?: string;
}) {
  return (
    <Card padding={false} className={cn("overflow-hidden", className)}>
      <CardHeader inset density="compact" title={title} hint={hint} action={headerAside} />
      <div className={cn(panelSubsectionInsetClass, "py-3")}>{children}</div>
    </Card>
  );
}

export function TeethPanelTabPanel({
  id,
  children,
  className,
  bare = false,
}: {
  id: string;
  /** @deprecated Zakładki zastąpił pasek etapów — zostaje dla zgodności. */
  labelledBy?: string;
  children: ReactNode;
  className?: string;
  /** Bez wewnętrznych marginesów karty (widok układa własne karty). */
  bare?: boolean;
}) {
  return (
    <div
      id={id}
      className={cn(bare ? "space-y-4" : cn(panelSectionInsetClass, "space-y-3 pb-4 pt-3"), className)}
    >
      {children}
    </div>
  );
}

/** Pusty stan widoku panelu zębów — karta z {@link EmptyState}. */
export function TeethPanelEmpty({
  title,
  description,
  icon,
  action,
}: {
  title: string;
  description?: string;
  icon: ReactNode;
  action?: ReactNode;
}) {
  return (
    <Card padding={false}>
      <EmptyState title={title} description={description} icon={icon} action={action} />
    </Card>
  );
}

export function TeethPanelListSkeleton({ groups = 3 }: { groups?: number }) {
  return (
    <div className="space-y-3" aria-busy="true" aria-label="Ładowanie listy">
      {Array.from({ length: groups }).map((_, index) => (
        <div
          key={index}
          className="overflow-hidden rounded-[var(--radius-panel)] border border-slate-200 bg-[var(--card)] shadow-[var(--shadow-card)] motion-safe:animate-pulse"
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
      <SlowLoadingNote message="Wczytywanie listy trwa dłużej niż zwykle…" className="justify-center" />
    </div>
  );
}
