"use client";

import { SystemNotice } from "@/components/ui/SystemNotice";

/** Informacja o trybie podglądu panelu w sekcji Zespół — spójna z AdminPreviewBanner. */
export function TeamPanelReadOnlyNotice({ className }: { className?: string }) {
  return (
    <SystemNotice
      variant="action"
      className={className ?? "mb-4"}
      title="Podgląd tylko do odczytu"
      description="Zarządzanie handlowcami i grupami wykonujesz w panelu administracji."
    />
  );
}
