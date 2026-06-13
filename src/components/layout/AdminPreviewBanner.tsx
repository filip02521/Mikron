"use client";

import { actionSetAdminPanelContext } from "@/app/actions/admin-panel-context";
import {
  labelForAdminPanelContext,
  type AdminPanelContext,
} from "@/lib/auth/admin-panel-context";
import { SystemNotice } from "@/components/ui/SystemNotice";

export function AdminPreviewBanner({
  panelContext,
  previewSalesPersonName,
}: {
  panelContext: AdminPanelContext;
  previewSalesPersonName?: string | null;
}) {
  const label = labelForAdminPanelContext(panelContext);
  const description = previewSalesPersonName?.trim()
    ? `Handlowiec: ${previewSalesPersonName.trim()}. Tryb tylko do odczytu — zmiany w panelu administracji.`
    : "Tryb tylko do odczytu. Zmiany w systemie wykonujesz z panelu administracji.";

  return (
    <SystemNotice
      variant="action"
      sticky
      className="sticky top-0 z-30 mb-4 md:top-2"
      title={`Podgląd panelu: ${label}`}
      description={description}
      actionLabel="Wróć do administracji"
      onAction={() => {
        void actionSetAdminPanelContext("admin");
      }}
    />
  );
}
