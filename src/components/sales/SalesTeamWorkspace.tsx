"use client";

import { AppBrandContentFooter } from "@/components/layout/AppBrandContentFooter";
import { PageHeader } from "@/components/ui/PageHeader";

/** Hub zespołu (DESIGN.md → Anatomia ekranu): nagłówek na tle, zakładki, treść. */
export function SalesTeamWorkspace({
  title,
  description,
  hint,
  hintAriaLabel = "O tej stronie",
  action,
  subnav,
  notices,
  children,
}: {
  title: string;
  description: string;
  hint?: string;
  hintAriaLabel?: string;
  action?: React.ReactNode;
  subnav?: React.ReactNode;
  notices?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div>
      <PageHeader
        title={title}
        description={description}
        hint={hint}
        hintAriaLabel={hintAriaLabel}
        actions={action}
        className="mb-4"
      />
      {subnav}
      <div className="mt-5 space-y-6">
        {notices}
        {children}
      </div>
      <AppBrandContentFooter mobileOnly variant="page" />
    </div>
  );
}
