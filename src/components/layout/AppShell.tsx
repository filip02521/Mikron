import { getSessionUser } from "@/lib/auth";
import { resolveSalesPersonForUser } from "@/lib/auth/sales-person";
import { canAccessOperations, canAccessWarehouse, isAdmin, isSalesAccount } from "@/lib/auth-roles";
import { canAccessOperationsNotepad, departmentsForRole } from "@/lib/operations/notepad-department";
import {
  countDeliveryQueue,
  countInformacjaQueue,
} from "@/lib/data/queries";
import { fetchOperationsDailyPanelMetrics } from "@/lib/orders/operations-daily-panel-version";
import { fetchSalesShellMetrics } from "@/lib/orders/sales-shell-metrics";
import { countNotepadNavBadge } from "@/lib/data/sales-notepad";
import {
  countOpenDepartmentBoardQuestions,
  countSalesBoardNavBadge,
  fetchSalesBoardAttentionSnapshot,
  type SalesBoardAttentionSnapshot,
} from "@/lib/data/department-board";
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
    salesTablica?: number;
    operationsNotatki?: number;
    departmentBoardQuestions?: number;
    adminBugReports?: number;
  } = { nowe: 0, weryfikacja: 0, realizacja: 0 };
  let salesActivityVersion: string | null = null;
  let operationsDailyPanelVersion: string | null = null;
  let salesPersonName: string | null = null;
  let salesBoardAttention: SalesBoardAttentionSnapshot | null = null;

  if (role && canAccessOperations(role)) {
    try {
      const [metrics, openQuestions] = await Promise.all([
        fetchOperationsDailyPanelMetrics(),
        countOpenDepartmentBoardQuestions().catch(() => 0),
      ]);
      navBadges.weryfikacja = metrics.verificationCount;
      navBadges.nowe = metrics.navBadge;
      navBadges.departmentBoardQuestions = openQuestions;
      operationsDailyPanelVersion = metrics.version;
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
        const [metrics, notatnikCount, tablicaCount, boardAttention] = await Promise.all([
          fetchSalesShellMetrics(salesPerson.id),
          countNotepadNavBadge(salesPerson.id).catch(() => 0),
          countSalesBoardNavBadge(session.id).catch(() => 0),
          fetchSalesBoardAttentionSnapshot(session.id).catch(() => null),
        ]);
        salesActivityVersion = metrics.activityVersion;
        salesBoardAttention = boardAttention;
        navBadges = {
          ...navBadges,
          salesMoje: metrics.navAttention,
          salesNotatnik: notatnikCount,
          salesTablica: tablicaCount,
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
      operationsDailyPanelVersion={operationsDailyPanelVersion}
      salesPersonId={session?.salesPersonId ?? null}
      mustChangePassword={session?.mustChangePassword ?? false}
      salesOnboardingCompletedAt={session?.salesOnboardingCompletedAt ?? null}
      salesPersonName={salesPersonName}
      salesBoardAttention={salesBoardAttention}
    >
      {children}
    </AppShellClient>
  );
}
