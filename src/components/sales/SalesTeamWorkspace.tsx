"use client";

import { NavIcon } from "@/components/icons/NavIcon";
import { SectionHeadingIcon } from "@/components/icons/SectionHeadingIcon";
import { AppBrandContentFooter } from "@/components/layout/AppBrandContentFooter";
import { Card, CardHeader } from "@/components/ui/Card";
import {
  salesCardBodyClass,
  sectionIconTileBrandClass,
} from "@/lib/ui/ontime-theme";

export function SalesTeamWorkspace({
  title,
  description,
  hint,
  hintAriaLabel = "O tej stronie",
  iconKey = "team",
  action,
  subnav,
  notices,
  children,
}: {
  title: string;
  description: string;
  hint?: string;
  hintAriaLabel?: string;
  iconKey?: "team" | "teamAccounts" | "teamGroups" | "vacation";
  action?: React.ReactNode;
  subnav?: React.ReactNode;
  notices?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Card padding={false} className="overflow-hidden">
      <CardHeader
        inset
        density="compact"
        leading={
          <SectionHeadingIcon tileClassName={sectionIconTileBrandClass}>
            <NavIcon navKey={iconKey} size={20} />
          </SectionHeadingIcon>
        }
        title={title}
        description={description}
        hint={hint}
        hintAriaLabel={hintAriaLabel}
        action={action}
      />
      {subnav}
      <div className={salesCardBodyClass}>
        {notices}
        {children}
      </div>
      <AppBrandContentFooter mobileOnly variant="page" />
    </Card>
  );
}
