"use client";

import { SuppliersHubNav } from "@/components/admin/SuppliersHubNav";
import { PageHeader } from "@/components/ui/PageHeader";
import { SupplierCardsHelpButton } from "@/components/admin/SupplierCardsHelpButton";
import type { SupplierHubContext, SupplierHubTab } from "@/lib/supplier-hub";
import type { SupplierLocation } from "@/types/database";
import { adminPageShellClass } from "@/lib/ui/ontime-theme";

export function SuppliersHubShell({
  title,
  description,
  activeTab,
  context,
  scheduleLocation = "POLSKA",
  locationNav,
  inactiveCount = 0,
  teethLane = false,
  children,
}: {
  title: string;
  description: string;
  activeTab: SupplierHubTab;
  context: SupplierHubContext;
  scheduleLocation?: SupplierLocation;
  locationNav?: React.ReactNode;
  inactiveCount?: number;
  teethLane?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className={adminPageShellClass}>
      <PageHeader
        back={context === "admin" ? { href: "/admin", label: "Administracja" } : undefined}
        title={title}
        description={description}
        actions={activeTab === "cards" ? <SupplierCardsHelpButton context={context} /> : undefined}
      />
      <SuppliersHubNav
        activeTab={activeTab}
        context={context}
        scheduleLocation={scheduleLocation}
        inactiveCount={inactiveCount}
        teethLane={teethLane}
      />
      {locationNav ? <div className="mt-4">{locationNav}</div> : null}
      <div className="mt-5 min-w-0 space-y-6">{children}</div>
    </div>
  );
}
