"use client";

import type { ReactNode } from "react";
import { Card } from "@/components/ui/Card";
import { SectionHeadingIcon } from "@/components/icons/SectionHeadingIcon";
import { TeethPanelContentFooter } from "@/components/zeby/TeethPanelContentFooter";
import { TeethFlowNav } from "@/components/zeby/TeethFlowNav";
import { cn } from "@/lib/cn";
import { TEETH_KOLEJKA_ICON_TILE } from "@/lib/teeth/teeth-panel-shell";

/** Szerokość obszaru roboczego panelu zębów — tabele specyfikacji potrzebują miejsca. */
export const teethWorkspaceShellClass = "relative mx-auto w-full max-w-5xl";

export function TeethPanelWorkspaceCard({
  title,
  hint,
  icon,
  iconTileClassName = TEETH_KOLEJKA_ICON_TILE,
  headerAside,
  children,
  showFooter = true,
  beforeCard,
  bare = false,
}: {
  title: string;
  /** Jedno zdanie pod tytułem: co tu robię. */
  hint?: string;
  /** @deprecated Opis jest widoczny wprost pod tytułem. */
  hintAriaLabel?: string;
  icon: ReactNode;
  iconTileClassName?: string;
  headerAside?: ReactNode;
  children: ReactNode;
  showFooter?: boolean;
  /** Toast, overlay — nad treścią w obrębie workspace. */
  beforeCard?: ReactNode;
  /** Treść bez wspólnej karty (widok sam układa karty, np. dostawcy w kolejce). */
  bare?: boolean;
}) {
  return (
    <div className={cn(teethWorkspaceShellClass, "space-y-4")}>
      {beforeCard}
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-start gap-3 sm:items-center">
          <SectionHeadingIcon tileClassName={iconTileClassName}>{icon}</SectionHeadingIcon>
          <div className="min-w-0">
            <h1 className="text-xl font-semibold tracking-tight text-slate-900">{title}</h1>
            {hint ? (
              <p className="mt-0.5 max-w-2xl text-xs leading-snug text-slate-500 sm:text-sm">{hint}</p>
            ) : null}
          </div>
        </div>
        {headerAside ? <div className="flex shrink-0 items-center gap-2">{headerAside}</div> : null}
      </header>

      <TeethFlowNav />

      {bare ? (
        <div id="teeth-panel-main" className="space-y-4">
          {children}
        </div>
      ) : (
        <Card padding={false} className="overflow-x-clip">
          <div id="teeth-panel-main">{children}</div>
        </Card>
      )}
      {showFooter ? (
        <div className="overflow-hidden rounded-lg">
          <TeethPanelContentFooter />
        </div>
      ) : null}
    </div>
  );
}
