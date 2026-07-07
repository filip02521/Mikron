"use client";

import type { ReactNode } from "react";
import { Card, CardHeader } from "@/components/ui/Card";
import { SectionHeadingIcon } from "@/components/icons/SectionHeadingIcon";
import { TeethPanelContentFooter } from "@/components/zeby/TeethPanelContentFooter";
import { panelWorkspaceShellClass } from "@/lib/ui/ontime-theme";
import { TEETH_KOLEJKA_ICON_TILE } from "@/lib/teeth/teeth-panel-shell";

export function TeethPanelWorkspaceCard({
  title,
  hint,
  hintAriaLabel,
  icon,
  iconTileClassName = TEETH_KOLEJKA_ICON_TILE,
  headerAside,
  children,
  showFooter = true,
  beforeCard,
}: {
  title: string;
  hint?: string;
  hintAriaLabel?: string;
  icon: ReactNode;
  iconTileClassName?: string;
  headerAside?: ReactNode;
  children: ReactNode;
  showFooter?: boolean;
  /** Toast, overlay — nad kartą w obrębie workspace. */
  beforeCard?: ReactNode;
}) {
  return (
    <div className={panelWorkspaceShellClass}>
      {beforeCard}
      <Card padding={false} className="overflow-x-clip">
        <CardHeader
          inset
          density="compact"
          leading={
            <SectionHeadingIcon tileClassName={iconTileClassName}>{icon}</SectionHeadingIcon>
          }
          title={title}
          hint={hint}
          hintAriaLabel={hintAriaLabel ?? `Informacja o widoku ${title}`}
          action={headerAside}
        />
        {children}
        {showFooter ? <TeethPanelContentFooter /> : null}
      </Card>
    </div>
  );
}
