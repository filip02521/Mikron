"use client";

import Link from "next/link";
import { BackChevron } from "@/components/ui/UiGlyphs";
import { SuppliersHubNav } from "@/components/admin/SuppliersHubNav";
import { NavIcon } from "@/components/icons/NavIcon";
import { navIconTileIdleClass, type NavIconKey } from "@/components/icons/NavIcon";
import { SectionHeadingIcon } from "@/components/icons/SectionHeadingIcon";
import { Card, CardHeader } from "@/components/ui/Card";
import { SupplierCardsHelpButton } from "@/components/admin/SupplierCardsHelpButton";
import type { SupplierHubContext, SupplierHubTab } from "@/lib/supplier-hub";
import type { SupplierLocation } from "@/types/database";
import { adminHubBodyClass, adminPageShellClass } from "@/lib/ui/ontime-theme";

const TAB_ICON: Record<SupplierHubTab, NavIconKey> = {
  cards: "suppliers",
  schedules: "schedule",
  inactive: "history",
  vacations: "vacation",
};

export function SuppliersHubShell({
  title,
  description,
  activeTab,
  context,
  scheduleLocation = "POLSKA",
  locationNav,
  inactiveCount = 0,
  children,
}: {
  title: string;
  description: string;
  activeTab: SupplierHubTab;
  context: SupplierHubContext;
  scheduleLocation?: SupplierLocation;
  locationNav?: React.ReactNode;
  inactiveCount?: number;
  children: React.ReactNode;
}) {
  const iconKey = TAB_ICON[activeTab];

  return (
    <div className={adminPageShellClass}>
      <Card padding={false} className="overflow-hidden">
        <CardHeader
          inset
          density="compact"
          leading={
            <SectionHeadingIcon tileClassName={navIconTileIdleClass(iconKey)}>
              <NavIcon navKey={iconKey} size={20} />
            </SectionHeadingIcon>
          }
          title={title}
          description={description}
          action={activeTab === "cards" ? <SupplierCardsHelpButton context={context} /> : undefined}
        />

        <div className="border-b border-slate-100 bg-slate-50/40 px-3 py-3 sm:px-4">
          {context === "admin" ? (
            <Link
              href="/admin"
              className="mb-3 inline-flex items-center gap-1.5 text-xs font-medium text-slate-600 underline-offset-2 hover:text-slate-900 hover:underline"
            >
              <BackChevron className="text-slate-500" />
              Administracja
            </Link>
          ) : null}
          <SuppliersHubNav
            activeTab={activeTab}
            context={context}
            scheduleLocation={scheduleLocation}
            inactiveCount={inactiveCount}
          />
          {locationNav ? <div className="mt-3">{locationNav}</div> : null}
        </div>

        <div className={adminHubBodyClass}>{children}</div>
      </Card>
    </div>
  );
}
