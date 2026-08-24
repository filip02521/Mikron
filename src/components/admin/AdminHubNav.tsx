"use client";

import {
  ADMIN_HUB_TAB_COPY,
  ADMIN_HUB_TAB_ORDER,
  adminHubHint,
  adminHubPaths,
  type AdminHubTab,
} from "@/lib/admin-hub";
import { SectionTabNav, type SectionTab } from "@/components/ui/SectionTabNav";

export function AdminHubNav({
  activeTab,
  visibleTabs = ADMIN_HUB_TAB_ORDER,
  embedded = false,
}: {
  activeTab: AdminHubTab;
  /** Gdy użytkownik ma tylko moduł Ivoclar — zwykle `["mail"]`. */
  visibleTabs?: readonly AdminHubTab[];
  embedded?: boolean;
}) {
  const paths = adminHubPaths();
  const order = visibleTabs.length ? visibleTabs : ADMIN_HUB_TAB_ORDER;
  const tabs: SectionTab<AdminHubTab>[] = order.map((id) => ({
    id,
    label: ADMIN_HUB_TAB_COPY[id].label,
    hint: ADMIN_HUB_TAB_COPY[id].hint,
    href: paths[id],
  }));

  return (
    <SectionTabNav
      activeTab={activeTab}
      tabs={tabs}
      contextHint={adminHubHint(activeTab)}
      ariaLabel="Zakładki administracji"
      embedded={embedded}
    />
  );
}
