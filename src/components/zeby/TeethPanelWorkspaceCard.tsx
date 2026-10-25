"use client";

import type { ReactNode } from "react";
import { Card } from "@/components/ui/Card";
import { HelpPopover, GuideIcon } from "@/components/ui/HelpPopover";
import { PageHeader } from "@/components/ui/PageHeader";
import { TeethPanelContentFooter } from "@/components/zeby/TeethPanelContentFooter";
import { TeethPanelHowItWorksContent } from "@/components/zeby/TeethPanelHowItWorks";

/** Szerokość obszaru roboczego panelu zębów — tabele specyfikacji potrzebują miejsca. */
export const teethWorkspaceShellClass = "relative mx-auto w-full max-w-5xl";

/** Ekran panelu zębów: nagłówek na tle (DESIGN.md → Anatomia ekranu), treść, stopka. */
export function TeethPanelWorkspaceCard({
  title,
  hint,
  headerAside,
  children,
  showFooter = true,
  beforeCard,
  bare = false,
}: {
  title: string;
  /** Jedno zdanie pod tytułem: co tu robię. */
  hint?: string;
  headerAside?: ReactNode;
  children: ReactNode;
  showFooter?: boolean;
  /** Toast, overlay — nad treścią w obrębie workspace. */
  beforeCard?: ReactNode;
  /** Treść bez wspólnej karty (widok sam układa karty, np. dostawcy w kolejce). */
  bare?: boolean;
}) {
  return (
    <div className={teethWorkspaceShellClass}>
      {beforeCard}
      <PageHeader
        title={title}
        description={hint}
        help={
          <HelpPopover
            label="Pomoc - panel zębów"
            title="Panel zębów"
            shortLabel=""
            icon={<GuideIcon />}
            align="left"
            buttonClassName="size-11 justify-center border-0 bg-transparent p-0 shadow-none hover:bg-slate-100 sm:size-8"
          >
            <TeethPanelHowItWorksContent />
          </HelpPopover>
        }
        actions={headerAside}
      />

      {bare ? (
        <div id="teeth-panel-main" className="space-y-5">
          {children}
        </div>
      ) : (
        <Card padding={false} className="overflow-x-clip">
          <div id="teeth-panel-main">{children}</div>
        </Card>
      )}
      {showFooter ? <TeethPanelContentFooter /> : null}
    </div>
  );
}
