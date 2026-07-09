import { fetchIndividualOrders, fetchDeliveryStats, fetchSalesAcknowledgedOrders, fetchSuppliersForRequestForms } from "@/lib/data/queries";
import { fetchSalesBoardAttentionSnapshot, fetchDepartmentBoardAnnouncements, type SalesBoardAttentionSnapshot, type DepartmentBoardAnnouncementsSlice } from "@/lib/data/department-board";
import { fetchSalesDayStartNotepadSlice } from "@/lib/data/sales-notepad";
import { fetchActiveDelegationsForDelegate, type VacationDelegationRow } from "@/lib/data/vacation-delegations";
import { getSessionUser } from "@/lib/auth";
import { resolveSalesPersonForUser } from "@/lib/auth/sales-person";
import { resolvePreviewSalesPerson, resolveDelegatePreviewSalesPerson } from "@/lib/auth/resolve-preview-sales-person";
import { getAppRole } from "@/lib/auth-dev";
import { logDevPageError } from "@/lib/dev/log-page-error";
import { canAccessOperations, isAdmin, isSalesAccount, isSalesManager } from "@/lib/auth-roles";
import { autoAssignMissingSuppliersFromCatalog } from "@/lib/services/auto-assign-suppliers";
import { loadPlannedOrderScheduleContext } from "@/lib/orders/planned-order-schedule";
import {
  ARCHIVE_EXPANDED_GROUP_LIMIT,
  archiveAcknowledgedSinceExpanded,
  archiveAcknowledgedSinceRecent,
  presentArchivedMyOrders,
} from "@/lib/orders/my-order-archive";
import { formatDateString } from "@/lib/orders/dates";
import { todayInWarsaw } from "@/lib/time/warsaw";
import type { DeliveryStats, IndividualOrder, UserRole, Workspace } from "@/types/database";
import type { OrderFormSupplierOption } from "@/lib/orders/order-form-suppliers";
import type { SalesDayStartContext } from "@/lib/sales/sales-day-start";

export type MojePageContext = {
  role: UserRole | null;
  workspaces: Workspace[];
  salesPersonId: string | null;
  salesPersonName: string | null;
  ownSalesPersonId: string | null;
  linkError: string | null;
  isTeamPreview: boolean;
  isDelegatePreview: boolean;
  activeDelegations: VacationDelegationRow[];
  sessionUserId: string | null;
};

export async function resolveMojePageContext(
  previewSalesPersonId: string | undefined,
): Promise<MojePageContext> {
  const role = await getAppRole();
  let workspaces: Workspace[] = [];
  let salesPersonId: string | null = null;
  let salesPersonName: string | null = null;
  let ownSalesPersonId: string | null = null;
  let linkError: string | null = null;
  let isTeamPreview = false;
  let isDelegatePreview = false;
  let activeDelegations: VacationDelegationRow[] = [];
  let sessionUserId: string | null = null;

  try {
    const user = await getSessionUser();
    sessionUserId = user?.id ?? null;
    workspaces = user?.assignedWorkspaces ?? [];

    if (user && isAdmin(user.role) && previewSalesPersonId) {
      const preview = await resolvePreviewSalesPerson(previewSalesPersonId, user);
      if (preview) {
        salesPersonId = preview.id;
        salesPersonName = preview.name;
        isTeamPreview = true;
      } else {
        linkError = "Nie znaleziono handlowca do podglądu.";
      }
    } else if (user && isSalesAccount(user.role)) {
      const own = await resolveSalesPersonForUser(user);
      ownSalesPersonId = own?.id ?? null;

      if (isSalesManager(user.role) && previewSalesPersonId) {
        const preview = await resolvePreviewSalesPerson(previewSalesPersonId, user);
        if (preview) {
          salesPersonId = preview.id;
          salesPersonName = preview.name;
          isTeamPreview = preview.id !== ownSalesPersonId;
        } else {
          linkError = "Nie znaleziono handlowca do podglądu.";
        }
      } else {
        salesPersonId = own?.id ?? null;
        salesPersonName = own?.name ?? null;

        if (user.role === "sales" || user.role === "sales_manager") {
          try {
            activeDelegations = await fetchActiveDelegationsForDelegate(user.id);
          } catch {}
        }

        if (
          user.role === "sales" &&
          previewSalesPersonId &&
          previewSalesPersonId !== ownSalesPersonId
        ) {
          const delegatePreview = await resolveDelegatePreviewSalesPerson(
            previewSalesPersonId,
            user,
          );
          if (delegatePreview) {
            salesPersonId = delegatePreview.id;
            salesPersonName = delegatePreview.name;
            isDelegatePreview = true;
          } else {
            linkError =
              "Możesz przeglądać tylko własne dane handlowca — parametr ?dla= został zignorowany.";
          }
        }
      }

      if (!ownSalesPersonId && user.role === "sales") {
        linkError =
          "Twoje konto nie jest przypisane do profilu handlowca. Poproś administratora o link zaproszenia (Admin → Handlowcy).";
      }
      if (!ownSalesPersonId && user.role === "sales_manager") {
        linkError =
          "Twoje konto kierownika nie jest przypisane do profilu handlowca — poproś administratora o przypisanie w sekcji Użytkownicy.";
      }
    } else {
      salesPersonId = user?.salesPersonId ?? null;
    }
  } catch (error) {
    logDevPageError("moje/page", error);
  }

  return {
    role,
    workspaces,
    salesPersonId,
    salesPersonName,
    ownSalesPersonId,
    linkError,
    isTeamPreview,
    isDelegatePreview,
    activeDelegations,
    sessionUserId,
  };
}

async function attachTeethDetailsIfNeeded(orders: IndividualOrder[]): Promise<IndividualOrder[]> {
  if (!orders.some((o) => o.is_teeth)) return orders;
  const { attachTeethDetailsToIndividualOrders } = await import("@/lib/data/teeth-queue");
  return attachTeethDetailsToIndividualOrders(orders);
}

async function scheduleAutoAssignSuppliers(
  orderRows: IndividualOrder[],
  salesPersonId: string | null,
  limit: number,
  logLabel: string,
): Promise<void> {
  const missing = orderRows.filter((o) => !o.supplier_id && o.subiekt_tw_id);
  if (missing.length === 0) return;
  const { after } = await import("next/server");
  after(async () => {
    try {
      await autoAssignMissingSuppliersFromCatalog({
        salesPersonId: salesPersonId ?? undefined,
        limit,
      });
    } catch (e) {
      console.error(`[${logLabel}]`, e);
    }
  });
}

export type MojePageData = {
  orders: IndividualOrder[];
  stats: DeliveryStats[];
  suppliers: OrderFormSupplierOption[];
  archiwumRecent: ReturnType<typeof presentArchivedMyOrders>;
  archiwumExtended: ReturnType<typeof presentArchivedMyOrders>;
  supplierScheduleById: Awaited<ReturnType<typeof loadPlannedOrderScheduleContext>>["supplierScheduleById"];
  plannedOrderWeekDays: Awaited<ReturnType<typeof loadPlannedOrderScheduleContext>>["weekDays"];
  boardAttention: SalesBoardAttentionSnapshot | null;
  boardAnnouncements: DepartmentBoardAnnouncementsSlice | null;
  boardAnnouncementsError: string | null;
  notepadSlice: Awaited<ReturnType<typeof fetchSalesDayStartNotepadSlice>> | null;
  loadError: string | null;
};

export async function loadMojePageData(
  ctx: MojePageContext,
  flags: {
    salesPanelView: boolean;
    viewingOwnPanel: boolean;
    isTeamPreview: boolean;
    delegatePreviewActive: boolean;
    adminSalesPreview: boolean;
    showSalesPersonOrdersPanel: boolean;
    loadMojeAnnouncements: boolean;
  },
): Promise<MojePageData> {
  const todayDateKey = formatDateString(todayInWarsaw());
  const {
    salesPersonId,
    sessionUserId,
    isTeamPreview,
  } = ctx;
  const {
    salesPanelView,
    viewingOwnPanel,
    delegatePreviewActive,
    adminSalesPreview,
    showSalesPersonOrdersPanel,
    loadMojeAnnouncements,
  } = flags;

  const empty: MojePageData = {
    orders: [],
    stats: [],
    suppliers: [],
    archiwumRecent: [],
    archiwumExtended: [],
    supplierScheduleById: {},
    plannedOrderWeekDays: [],
    boardAttention: null,
    boardAnnouncements: null,
    boardAnnouncementsError: null,
    notepadSlice: null,
    loadError: null,
  };

  if (!salesPersonId) return empty;

  try {
    if (salesPanelView) {
      let boardAnnouncementsError: string | null = null;

      const [
        orderRows,
        statsRows,
        acknowledgedRows_,
        supplierRows,
        boardSnap,
        notepadData,
        announcementsSlice,
      ] = await Promise.all([
        fetchIndividualOrders({ salesPersonId, hideSalesAcknowledged: false }),
        fetchDeliveryStats(),
        viewingOwnPanel || isTeamPreview || delegatePreviewActive
          ? fetchSalesAcknowledgedOrders(salesPersonId, {
              acknowledgedSince: archiveAcknowledgedSinceExpanded(),
              limit: 200,
            })
          : Promise.resolve([] as IndividualOrder[]),
        fetchSuppliersForRequestForms(),
        viewingOwnPanel && sessionUserId
          ? fetchSalesBoardAttentionSnapshot(sessionUserId).catch(() => null)
          : Promise.resolve(null),
        viewingOwnPanel
          ? fetchSalesDayStartNotepadSlice(salesPersonId).catch(() => null)
          : Promise.resolve(null),
        loadMojeAnnouncements
          ? fetchDepartmentBoardAnnouncements(sessionUserId!).catch((e) => {
              boardAnnouncementsError =
                e instanceof Error
                  ? e.message
                  : "Nie udało się załadować ogłoszeń od zakupów.";
              console.error("[moje/page] fetchDepartmentBoardAnnouncements", e);
              return null;
            })
          : Promise.resolve(null),
      ]);

      let acknowledgedRows = acknowledgedRows_;
      const orders = await attachTeethDetailsIfNeeded(orderRows);
      const stats = statsRows as DeliveryStats[];
      const suppliers = supplierRows;

      const { supplierScheduleById, weekDays } =
        await loadPlannedOrderScheduleContext(orderRows, todayDateKey);

      if (!adminSalesPreview) {
        await scheduleAutoAssignSuppliers(orderRows, salesPersonId, 80, "autoAssignMissingSuppliersFromCatalog moje");
      }

      let archiwumRecent: MojePageData["archiwumRecent"] = [];
      let archiwumExtended: MojePageData["archiwumExtended"] = [];

      if (showSalesPersonOrdersPanel) {
        acknowledgedRows = await attachTeethDetailsIfNeeded(acknowledgedRows);
        const legacyUnackedCancelled = orderRows.filter(
          (o) => o.status === "Anulowane" && !o.sales_acknowledged_at,
        );
        const archiveSource = [...acknowledgedRows, ...legacyUnackedCancelled];
        archiwumRecent = presentArchivedMyOrders(archiveSource, stats, {
          acknowledgedSince: archiveAcknowledgedSinceRecent(),
        });
        archiwumExtended = presentArchivedMyOrders(archiveSource, stats, {
          acknowledgedSince: archiveAcknowledgedSinceExpanded(),
          groupLimit: ARCHIVE_EXPANDED_GROUP_LIMIT,
        });
      }

      return {
        orders,
        stats,
        suppliers,
        archiwumRecent,
        archiwumExtended,
        supplierScheduleById,
        plannedOrderWeekDays: weekDays,
        boardAttention: boardSnap,
        boardAnnouncements: announcementsSlice,
        boardAnnouncementsError,
        notepadSlice: notepadData,
        loadError: null,
      };
    } else if (ctx.role && canAccessOperations(ctx.role, ctx.workspaces)) {
      const [orderRows, statsRows, supplierRows] = await Promise.all([
        fetchIndividualOrders({ salesPersonId }),
        fetchDeliveryStats(),
        fetchSuppliersForRequestForms(),
      ]);

      const orders = await attachTeethDetailsIfNeeded(orderRows);
      const stats = statsRows as DeliveryStats[];
      const { supplierScheduleById, weekDays } =
        await loadPlannedOrderScheduleContext(orderRows, todayDateKey);

      await scheduleAutoAssignSuppliers(orderRows, salesPersonId, 120, "autoAssignMissingSuppliersFromCatalog ops moje");

      return {
        ...empty,
        orders,
        stats,
        suppliers: supplierRows,
        supplierScheduleById,
        plannedOrderWeekDays: weekDays,
      };
    }
  } catch (e) {
    return {
      ...empty,
      loadError: e instanceof Error ? e.message : "Nie udało się załadować zamówień.",
    };
  }

  return empty;
}

export function buildDayStartContext(
  viewingOwnPanel: boolean,
  notepadSlice: MojePageData["notepadSlice"],
  boardAttention: SalesBoardAttentionSnapshot | null,
  previewSalesPersonId: string | undefined,
): SalesDayStartContext | null {
  if (!viewingOwnPanel || !notepadSlice) return null;
  return {
    watches: notepadSlice.zkWatches,
    notes: notepadSlice.notes,
    boardAttention,
    previewDla: previewSalesPersonId ?? null,
  };
}
