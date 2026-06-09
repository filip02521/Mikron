"use client";

import { actionSetAdminPanelContext } from "@/app/actions/admin-panel-context";
import {
  labelForAdminPanelContext,
  type AdminPanelContext,
} from "@/lib/auth/admin-panel-context";
import { SystemNotice } from "@/components/ui/SystemNotice";

export function AdminPreviewBanner({
  panelContext,
}: {
  panelContext: AdminPanelContext;
}) {
  const label = labelForAdminPanelContext(panelContext);

  return (
    <SystemNotice
      variant="action"
      sticky
      className="sticky top-0 z-30 mb-4 md:top-2"
      title={`Podgląd panelu: ${label}`}
      description="Tryb tylko do odczytu. Zmiany w systemie wykonujesz z panelu administracji."
      actionLabel="Wróć do administracji"
      onAction={() => {
        void actionSetAdminPanelContext("admin");
      }}
    />
  );
}
