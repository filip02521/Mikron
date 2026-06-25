import { headers } from "next/headers";
import { Suspense } from "react";
import { getSessionUser } from "@/lib/auth";
import { isAuthLayoutPath } from "@/lib/auth/auth-layout-paths";
import {
  effectiveNavRole,
  isAdminPanelPreview,
  type AdminPanelContext,
} from "@/lib/auth/admin-panel-context";
import { readAdminPanelContextForSession } from "@/lib/auth/read-admin-panel-context";
import { isSalesAccount } from "@/lib/auth-roles";
import { fetchTeethProductTwIds } from "@/lib/data/teeth-products";
import { AppShellClient } from "./AppShellClient";
import { AppShellMetricsProvider } from "./AppShellMetricsContext";
import { AppShellMetricsLoader } from "./AppShellMetricsLoader";

export async function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = (await headers()).get("x-pathname") ?? "";
  const lightShell = isAuthLayoutPath(pathname);

  const session = await getSessionUser();
  const realRole = session?.role ?? null;
  const { panelContext } = lightShell
    ? { panelContext: null as AdminPanelContext | null }
    : await readAdminPanelContextForSession();
  const role = realRole ? effectiveNavRole(realRole, panelContext) : null;
  const adminPanelPreview =
    !lightShell &&
    realRole &&
    isAdminPanelPreview(realRole, panelContext) &&
    panelContext
      ? panelContext
      : null;
  const showSalesOnboarding =
    !lightShell &&
    !adminPanelPreview &&
    Boolean(role && isSalesAccount(role)) &&
    Boolean(session?.salesPersonId) &&
    !session?.mustChangePassword &&
    !session?.salesOnboardingCompletedAt;

  const teethExemptTwIds =
    session && !lightShell ? await fetchTeethProductTwIds().catch(() => []) : [];

  const shell = (
    <AppShellClient
      role={role}
      realRole={realRole}
      adminPanelPreview={adminPanelPreview as AdminPanelContext | null}
      userEmail={session?.email ?? null}
      showLoginLink={!realRole}
      salesPersonId={session?.salesPersonId ?? null}
      mustChangePassword={session?.mustChangePassword ?? false}
      salesOnboardingCompletedAt={session?.salesOnboardingCompletedAt ?? null}
      salesOnboardingActive={showSalesOnboarding}
      teethExemptTwIds={teethExemptTwIds}
    >
      {children}
    </AppShellClient>
  );

  if (lightShell || !session) {
    return shell;
  }

  const previewHeaderId = (await headers()).get("x-preview-sales-person-id");

  return (
    <AppShellMetricsProvider>
      <Suspense fallback={null}>
        <AppShellMetricsLoader
          input={{
            realRole,
            role,
            session,
            panelContext,
            adminPanelPreview,
            showSalesOnboarding,
            previewHeaderId,
          }}
        />
      </Suspense>
      {shell}
    </AppShellMetricsProvider>
  );
}
