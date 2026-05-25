"use client";

import { SuppliersHubNav } from "@/components/admin/SuppliersHubNav";
import { NavIcon } from "@/components/icons/NavIcon";
import { navIconTileIdleClass, type NavIconKey } from "@/components/icons/NavIcon";
import { SectionHeadingIcon } from "@/components/icons/SectionHeadingIcon";
import { Card, CardHeader } from "@/components/ui/Card";
import type { SupplierHubContext, SupplierHubTab } from "@/lib/supplier-hub";
import type { SupplierLocation } from "@/types/database";

const TAB_ICON: Record<SupplierHubTab, NavIconKey> = {
  cards: "suppliers",
  schedules: "schedule",
  vacations: "vacation",
};

export function SuppliersHubShell({
  title,
  description,
  activeTab,
  context,
  scheduleLocation = "POLSKA",
  locationNav,
  children,
}: {
  title: string;
  description: string;
  activeTab: SupplierHubTab;
  context: SupplierHubContext;
  scheduleLocation?: SupplierLocation;
  locationNav?: React.ReactNode;
  children: React.ReactNode;
}) {
  const iconKey = TAB_ICON[activeTab];

  return (
    <div className="mx-auto max-w-6xl">
      <Card padding={false} className="overflow-hidden">
        <CardHeader
          inset
          leading={
            <SectionHeadingIcon tileClassName={navIconTileIdleClass(iconKey)}>
              <NavIcon navKey={iconKey} size={20} />
            </SectionHeadingIcon>
          }
          title={title}
          description={description}
        />

        <div className="border-b border-slate-100 bg-slate-50/40 px-3 py-3 sm:px-4">
          <SuppliersHubNav
            activeTab={activeTab}
            context={context}
            scheduleLocation={scheduleLocation}
          />
          {locationNav ? <div className="mt-3">{locationNav}</div> : null}
        </div>

        <div className="min-w-0">{children}</div>
      </Card>
    </div>
  );
}
