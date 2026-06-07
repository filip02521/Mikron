"use client";

import {
  SUPPLIER_HUB_TAB_COPY,
  supplierHubHint,
  supplierHubPaths,
  type SupplierHubContext,
  type SupplierHubTab,
} from "@/lib/supplier-hub";
import { SectionTabNav, type SectionTab } from "@/components/ui/SectionTabNav";
import type { SupplierLocation } from "@/types/database";

const TAB_ORDER: SupplierHubTab[] = ["cards", "schedules", "inactive", "vacations"];

export function SuppliersHubNav({
  activeTab,
  context,
  scheduleLocation = "POLSKA",
  inactiveCount = 0,
}: {
  activeTab: SupplierHubTab;
  context: SupplierHubContext;
  scheduleLocation?: SupplierLocation;
  inactiveCount?: number;
}) {
  const paths = supplierHubPaths(context);

  const tabs: SectionTab<SupplierHubTab>[] = TAB_ORDER.map((id) => ({
    id,
    label: SUPPLIER_HUB_TAB_COPY[id].label,
    hint: SUPPLIER_HUB_TAB_COPY[id].hint,
    href:
      id === "cards"
        ? paths.cards
        : id === "inactive"
          ? paths.inactive
          : id === "vacations"
            ? paths.vacations
            : paths.schedule(scheduleLocation),
    badgeCount: id === "inactive" ? inactiveCount : undefined,
  }));

  return (
    <SectionTabNav
      activeTab={activeTab}
      tabs={tabs}
      contextHint={supplierHubHint(activeTab)}
      ariaLabel="Zakładki sekcji dostawców"
      embedded
    />
  );
}
