import type { ReactNode } from "react";
import {
  SalesPageAlerts,
  type SalesTeamPreview,
} from "@/components/sales/SalesPageAlerts";
import { DelegateModeBackground } from "@/components/moje/DelegatePreviewContext";

/** Wspólny układ stron podglądu handlowca (?dla=) — bez drugiego salesPageShellClass. */
export function SalesPreviewPageChrome({
  linkError,
  teamPreview,
  children,
}: {
  linkError?: string | null;
  teamPreview?: SalesTeamPreview | null;
  children: ReactNode;
}) {
  const hasAlerts = teamPreview || linkError;
  if (!hasAlerts) {
    return children;
  }

  return (
    <DelegateModeBackground active={Boolean(teamPreview)} label={teamPreview?.salesPersonName ?? null}>
      <div className="space-y-4">
        <SalesPageAlerts
          teamPreview={teamPreview}
          linkError={linkError}
          linkErrorClassName="mb-0"
          linkErrorWarningOnIgnored={false}
        />
        {children}
      </div>
    </DelegateModeBackground>
  );
}
