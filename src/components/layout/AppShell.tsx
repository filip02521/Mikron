import { getSessionUser } from "@/lib/auth";
import { resolveSalesPersonForUser } from "@/lib/auth/sales-person";
import { canAccessOperations, canAccessWarehouse, isAdmin, isSalesAccount } from "@/lib/auth-roles";
import { canAccessOperationsNotepad, departmentsForRole } from "@/lib/operations/notepad-department";
import {
  countVerificationOrders,
  fetchIndividualOrders,
  countDeliveryQueue,
  fetchSuppliersWithSchedules,
} from "@/lib/data/queries";
import { buildSummaryWorkspace } from "@/lib/orders/summary-workspace";
import { countDailyPanelNavBadge } from "@/lib/orders/procurement-daily-ui";
import { computeSalesActivityVersion } from "@/lib/orders/sales-activity-version";
import { countSalesNavAttention } from "@/lib/orders/sales-nav-attention";
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

  if (role && canAccessWarehouse(role)) {
    try {
      const { countInformacjaQueue } = await import("@/lib/data/queries");
      const [realizacjaCount, informacjaCount] = await Promise.all([
        countDeliveryQueue(),
        countInformacjaQueue().catch(() => 0),
      ]);
      if (canAccessOperations(role)) {
        const [schedules, newOrders, weryfikacja] = await Promise.all([
          fetchSuppliersWithSchedules(),
          fetchIndividualOrders({ status: "Nowe", hideSalesAcknowledged: false }),
          countVerificationOrders(),
        ]);
        const workspace = buildSummaryWorkspace(
          schedules,
          newOrders.filter((o) => o.status === "Nowe")
        );
        navBadges = {
          nowe: countDailyPanelNavBadge(workspace),
          weryfikacja,
          realizacja: realizacjaCount + informacjaCount,
        };
      } else {
        navBadges = { nowe: 0, weryfikacja: 0, realizacja: realizacjaCount + informacjaCount };
      }
    } catch {
      navBadges = { nowe: 0, weryfikacja: 0, realizacja: 0 };
    }
  }

  if (role && isSalesAccount(role) && session) {
    try {
      const salesPerson = await resolveSalesPersonForUser(session);
      if (salesPerson) {
        salesPersonName = salesPerson.name;
        const [version, attention, notatnikCount] = await Promise.all([
          computeSalesActivityVersion(salesPerson.id),
          countSalesNavAttention(salesPerson.id),
          countNotepadNavBadge(salesPerson.id).catch(() => 0),
        ]);
        salesActivityVersion = version;
        navBadges = {
          ...navBadges,
          salesMoje: attention,
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
