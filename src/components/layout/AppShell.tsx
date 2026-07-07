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
import { readProcurementWorkspaceForSession } from "@/lib/auth/read-procurement-workspace";
import type { ProcurementWorkspace } from "@/lib/auth/procurement-workspace";
import { isSalesAccount } from "@/lib/auth-roles";
import { fetchTeethProductInfo } from "@/lib/data/teeth-products";
import { fetchActiveDelegationsForDelegate, type VacationDelegationRow } from "@/lib/data/vacation-delegations";
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
  const { procurementWorkspace, canSwitchProcurementWorkspace } = lightShell
    ? { procurementWorkspace: null as ProcurementWorkspace | null, canSwitchProcurementWorkspace: false }
    : await readProcurementWorkspaceForSession();
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

  const teethProductInfo =
    session && !lightShell
      ? await fetchTeethProductInfo().catch((e) => {
          console.error("[AppShell] fetchTeethProductInfo failed:", e?.message ?? e);
          return [];
        })
      : [];

  const activeDelegations: VacationDelegationRow[] =
    session && !lightShell && isSalesAccount(session.role)
      ? await fetchActiveDelegationsForDelegate(session.id).catch((e) => {
          console.error("[AppShell] fetchActiveDelegationsForDelegate failed:", e?.message ?? e);
          return [];
        })
      : [];

  const shell = (
    <AppShellClient
      role={role}
      realRole={realRole}
      adminPanelPreview={adminPanelPreview as AdminPanelContext | null}
      procurementWorkspace={procurementWorkspace}
      canSwitchProcurementWorkspace={canSwitchProcurementWorkspace}
      userEmail={session?.email ?? null}
      showLoginLink={!realRole}
      salesPersonId={session?.salesPersonId ?? null}
      mustChangePassword={session?.mustChangePassword ?? false}
      salesOnboardingCompletedAt={session?.salesOnboardingCompletedAt ?? null}
      salesOnboardingActive={showSalesOnboarding}
      teethProductInfo={teethProductInfo}
      assignedWorkspaces={session?.assignedWorkspaces ?? []}
      activeDelegations={activeDelegations}
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
            procurementWorkspace,
            workspaces: session.assignedWorkspaces,
          }}
        />
      </Suspense>
      {shell}
    </AppShellMetricsProvider>
  );
}
