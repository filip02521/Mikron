import { resolvePreviewSalesPerson } from "@/lib/auth/resolve-preview-sales-person";
import {
  shouldApplyAdminSalesPreviewHeader,
  type AdminPanelContext,
} from "@/lib/auth/admin-panel-context";
import type { SessionUser } from "@/lib/auth";
import { resolveSalesPersonForUser } from "@/lib/auth/sales-person";
import {
  canAccessOperations,
  canAccessWarehouse,
  isAdmin,
  isSalesAccount,
} from "@/lib/auth-roles";
import { canAccessOperationsNotepad, departmentsForRole } from "@/lib/operations/notepad-department";
import {
  countDeliveryQueue,
  countInformacjaQueue,
} from "@/lib/data/queries";
import { fetchOperationsDailyPanelMetrics } from "@/lib/orders/operations-daily-panel-version";
import { fetchSalesShellMetrics } from "@/lib/orders/sales-shell-metrics";
import {
  countOpenDepartmentBoardQuestions,
  fetchPinnedActiveAnnouncements,
  fetchSalesBoardAttentionSnapshot,
} from "@/lib/data/department-board";
import { countOpenSalesBugReports } from "@/lib/data/sales-bug-reports";
import type { UserRole } from "@/types/database";
import {
  EMPTY_APP_SHELL_METRICS,
  type AppShellMetrics,
} from "@/lib/layout/app-shell-metrics-types";
import { resolveUserAssignmentLabel } from "@/lib/layout/user-assignment-label";

export type AppShellMetricsInput = {
  realRole: UserRole | null;
  role: UserRole | null;
  session: SessionUser;
  panelContext: AdminPanelContext | null;
  adminPanelPreview: AdminPanelContext | null;
  showSalesOnboarding: boolean;
  previewHeaderId: string | null;
};

export async function fetchAppShellMetrics(
  input: AppShellMetricsInput
): Promise<AppShellMetrics> {
  const {
    realRole,
    role,
    session,
    panelContext,
    adminPanelPreview,
    showSalesOnboarding,
    previewHeaderId,
  } = input;

  let navBadges = { ...EMPTY_APP_SHELL_METRICS.navBadges };
  let salesActivityVersion: string | null = null;
  let operationsDailyPanelVersion: string | null = null;
  let salesPersonName: string | null = null;
  let headerSalesPersonId: string | null = null;
  let salesBoardAttention = null as AppShellMetrics["salesBoardAttention"];
  let operationsPinnedAnnouncements = EMPTY_APP_SHELL_METRICS.operationsPinnedAnnouncements;

  if (role && canAccessOperations(role)) {
    try {
      const [metrics, openQuestions, pinnedAnnouncements] = await Promise.all([
        fetchOperationsDailyPanelMetrics(),
        countOpenDepartmentBoardQuestions().catch(() => 0),
        fetchPinnedActiveAnnouncements().catch(() => []),
      ]);
      navBadges = {
        ...navBadges,
        weryfikacja: metrics.verificationCount,
        nowe: metrics.navBadge,
        departmentBoardQuestions: openQuestions,
      };
      operationsDailyPanelVersion = metrics.version;
      operationsPinnedAnnouncements = pinnedAnnouncements;
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

  if (realRole && isAdmin(realRole)) {
    try {
      const previewId = shouldApplyAdminSalesPreviewHeader(panelContext, previewHeaderId)
        ? previewHeaderId
        : null;
      if (previewId) {
        const preview = await resolvePreviewSalesPerson(previewId, session);
        if (preview) {
          salesPersonName = preview.name;
          headerSalesPersonId = preview.id;
          const metrics = await fetchSalesShellMetrics(preview.id, null);
          salesActivityVersion = metrics.activityVersion;
          navBadges = {
            ...navBadges,
            salesMoje: metrics.dayStartNavCount,
            salesZkDue: metrics.zkNavBadge,
            salesNotesDue: metrics.notesNavBadge,
            salesTablica: 0,
          };
        }
      } else if (!adminPanelPreview) {
        const own = await resolveSalesPersonForUser(session);
        if (own) {
          salesPersonName = own.name;
          headerSalesPersonId = own.id;
        }
      }
    } catch {
      /* opcjonalny podgląd */
    }
  }

  if (
    role &&
    isSalesAccount(role) &&
    !salesPersonName &&
    !adminPanelPreview
  ) {
    try {
      const salesPerson = await resolveSalesPersonForUser(session);
      if (salesPerson) {
        salesPersonName = salesPerson.name;
        headerSalesPersonId = salesPerson.id;
        if (showSalesOnboarding) {
          navBadges = {
            ...navBadges,
            salesMoje: 0,
            salesZkDue: 0,
            salesNotesDue: 0,
            salesTablica: 0,
          };
        } else {
          const [metrics, boardAttention] = await Promise.all([
            fetchSalesShellMetrics(salesPerson.id, session.id),
            fetchSalesBoardAttentionSnapshot(session.id).catch(() => null),
          ]);
          salesActivityVersion = metrics.activityVersion;
          salesBoardAttention = boardAttention;
          navBadges = {
            ...navBadges,
            salesMoje: metrics.dayStartNavCount,
            salesZkDue: metrics.zkNavBadge,
            salesNotesDue: metrics.notesNavBadge,
            salesTablica: metrics.boardNavBadge,
          };
        }
      }
    } catch {
      salesActivityVersion = null;
    }
  }

  if (role && session.id && canAccessOperationsNotepad(role)) {
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

  if (realRole && isAdmin(realRole)) {
    try {
      const openReports = await countOpenSalesBugReports();
      navBadges = { ...navBadges, adminBugReports: openReports };
    } catch {
      /* empty */
    }
  }

  let userAssignmentLabel: string | null = null;
  try {
    userAssignmentLabel = await resolveUserAssignmentLabel({
      role: realRole ?? role,
      session,
      salesPersonId: headerSalesPersonId,
    });
  } catch {
    /* opcjonalny opis konta */
  }

  return {
    navBadges,
    salesActivityVersion,
    operationsDailyPanelVersion,
    salesPersonName,
    userAssignmentLabel,
    salesBoardAttention,
    operationsPinnedAnnouncements,
  };
}
