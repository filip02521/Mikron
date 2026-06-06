import { getSessionUser } from "@/lib/auth";
import { resolveSalesPersonForUser } from "@/lib/auth/sales-person";
import { canAccessOperations, canAccessWarehouse, isAdmin, isSalesAccount } from "@/lib/auth-roles";
import { canAccessOperationsNotepad, departmentsForRole } from "@/lib/operations/notepad-department";
import {
  countVerificationOrders,
  countDeliveryQueue,
  countInformacjaQueue,
} from "@/lib/data/queries";
import { countDailyPanelNavBadgeForNav } from "@/lib/orders/daily-panel-nav-badge";
import { fetchSalesShellMetrics } from "@/lib/orders/sales-shell-metrics";
import { countNotepadNavBadge } from "@/lib/data/sales-notepad";
import { countOpenSalesBugReports } from "@/lib/data/sales-bug-reports";
import { AppShellClient } from "./AppShellClient";

export async function AppShell({ children }: { children: React.ReactNode }) {
  const session = await getSessionUser();
  const role = session?.role ?? null;
  let navBadges: {
    nowe: number;
    weryfikacja: number;
    realizacja: number;
    salesMoje?: number;
    salesNotatnik?: number;
    operationsNotatki?: number;
    adminBugReports?: number;
  } = { nowe: 0, weryfikacja: 0, realizacja: 0 };
  let salesActivityVersion: string | null = null;
  let salesPersonName: string | null = null;

  if (role && canAccessOperations(role)) {
    try {
      navBadges.weryfikacja = await countVerificationOrders();
    } catch {
      /* badge opcjonalny */
    }
    try {
      navBadges.nowe = await countDailyPanelNavBadgeForNav();
    } catch {
      /* badge opcjonalny */
    }
  }

  if (role && canAccessWarehouse(role)) {
    try {
      const [realizacjaCount, informacjaCount] = await Promise.all([
        countDeliveryQueue(),
        countInformacjaQueue().catch(() => 0),
      ]);
      navBadges = {
        ...navBadges,
        realizacja: realizacjaCount + informacjaCount,
      };
    } catch {
      /* badge opcjonalny */
    }
  }

  if (role && isSalesAccount(role) && session) {
    try {
      const salesPerson = await resolveSalesPersonForUser(session);
      if (salesPerson) {
        salesPersonName = salesPerson.name;
        const [metrics, notatnikCount] = await Promise.all([
          fetchSalesShellMetrics(salesPerson.id),
          countNotepadNavBadge(salesPerson.id).catch(() => 0),
        ]);
        salesActivityVersion = metrics.activityVersion;
        navBadges = {
          ...navBadges,
          salesMoje: metrics.navAttention,
          salesNotatnik: notatnikCount,
        };
      }
    } catch {
      salesActivityVersion = null;
    }
  }

  if (role && session?.id && canAccessOperationsNotepad(role)) {
    try {
      const { countOperationsNotepadBadge } = await import("@/lib/data/operations-notepad");
      const count = await countOperationsNotepadBadge(
        session.id,
        departmentsForRole(role)
      );
      navBadges = { ...navBadges, operationsNotatki: count };
    } catch {
      /* empty */
    }
  }

  if (role && isAdmin(role)) {
    try {
      const openReports = await countOpenSalesBugReports();
      navBadges = { ...navBadges, adminBugReports: openReports };
    } catch {
      /* empty */
    }
  }

  return (
    <AppShellClient
      role={role}
      userEmail={session?.email ?? null}
      showLoginLink={!role}
      navBadges={navBadges}
      salesActivityVersion={salesActivityVersion}
      salesPersonId={session?.salesPersonId ?? null}
      mustChangePassword={session?.mustChangePassword ?? false}
      salesOnboardingCompletedAt={session?.salesOnboardingCompletedAt ?? null}
      salesPersonName={salesPersonName}
    >
      {children}
    </AppShellClient>
  );
}
