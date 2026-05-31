"use client";

import { isSalesAccount } from "@/lib/auth-roles";
import { SalesOnboardingProvider } from "@/components/sales/SalesOnboardingContext";
import { SalesOnboardingWizard } from "@/components/sales/SalesOnboardingWizard";
import type { UserRole } from "@/types/database";

export function SalesOnboardingGate({
  role,
  salesPersonId,
  mustChangePassword,
  salesOnboardingCompletedAt,
  salesPersonName,
  children,
}: {
  role: UserRole | null;
  salesPersonId: string | null;
  mustChangePassword: boolean;
  salesOnboardingCompletedAt: string | null;
  salesPersonName?: string | null;
  children: React.ReactNode;
}) {
  const showWizard =
    Boolean(role && isSalesAccount(role)) &&
    Boolean(salesPersonId) &&
    !mustChangePassword &&
    !salesOnboardingCompletedAt;

  if (!showWizard || !role) {
    return <>{children}</>;
  }

  return (
    <SalesOnboardingProvider active role={role} displayName={salesPersonName}>
      {children}
      <SalesOnboardingWizard />
    </SalesOnboardingProvider>
  );
}
