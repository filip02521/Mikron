"use client";

import {
  ADMIN_HUB_TAB_COPY,
  adminHubHint,
  adminHubPaths,
  type AdminHubTab,
} from "@/lib/admin-hub";
import { SectionTabNav, type SectionTab } from "@/components/ui/SectionTabNav";

const TAB_ORDER: AdminHubTab[] = ["system", "users", "sales"];

export function AdminHubNav({
  activeTab,
  embedded = false,
}: {
  activeTab: AdminHubTab;
  embedded?: boolean;
}) {
  const paths = adminHubPaths();
  const tabs: SectionTab<AdminHubTab>[] = TAB_ORDER.map((id) => ({
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
