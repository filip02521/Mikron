import {
  fetchDeliveryStats,
  fetchIndividualOrders,
  fetchSalesAcknowledgedOrders,
  fetchSuppliersForRequestForms,
} from "@/lib/data/queries";
import { formatDateString } from "@/lib/orders/dates";
import { todayInWarsaw } from "@/lib/time/warsaw";
import {
  ARCHIVE_EXPANDED_GROUP_LIMIT,
  archiveAcknowledgedSinceExpanded,
  archiveAcknowledgedSinceRecent,
  presentArchivedMyOrders,
} from "@/lib/orders/my-order-archive";
import { getSessionUser } from "@/lib/auth";
import { resolveSalesPersonForUser } from "@/lib/auth/sales-person";
import { resolvePreviewSalesPerson, resolveDelegatePreviewSalesPerson } from "@/lib/auth/resolve-preview-sales-person";
import { getAppRole } from "@/lib/auth-dev";
import { logDevPageError } from "@/lib/dev/log-page-error";
import { canAccessOperations, isAdmin, isSalesAccount, isSalesManager } from "@/lib/auth-roles";
import { presentMyOrders } from "@/lib/orders/my-order-presenter";
import { loadPlannedOrderScheduleContext } from "@/lib/orders/planned-order-schedule";
import { getSubiektAvailability } from "@/lib/subiekt/availability";
import {
  countZdEtaMojeClientSyncMount,
  countZdEtaMojeClientSyncTriggers,
} from "@/lib/subiekt/zd-eta-sync";
import { getAppSupplierRefsCached } from "@/lib/data/supplier-refs";
import { buildSupplierKhIdsBySupplierId } from "@/lib/data/supplier-subiekt-kh";
import { isSubiektAvailableForZdSync } from "@/lib/subiekt/availability";
import Link from "next/link";
import { Alert } from "@/components/ui/Alert";
import { MojeOrdersShell } from "@/components/moje/MojeOrdersShell";
import type { OrderFormSupplierOption } from "@/lib/orders/order-form-suppliers";
import {
  buttonPrimaryClass,
  pageToolbarSizingClass,
  salesPageShellClass,
} from "@/lib/ui/ontime-theme";
import { cn } from "@/lib/cn";
import { SalesAccountLinkRequired } from "@/components/sales/SalesAccountLinkRequired";
import { SalesPageAlerts } from "@/components/sales/SalesPageAlerts";
import { SystemNotice } from "@/components/ui/SystemNotice";
import {
  fetchSalesBoardAttentionSnapshot,
  fetchDepartmentBoardAnnouncements,
  type SalesBoardAttentionSnapshot,
  type DepartmentBoardAnnouncementsSlice,
} from "@/lib/data/department-board";
import { fetchSalesDayStartNotepadSlice } from "@/lib/data/sales-notepad";
import { fetchActiveDelegationsForDelegate, type VacationDelegationRow } from "@/lib/data/vacation-delegations";
import {
  type SalesDayStartContext,
} from "@/lib/sales/sales-day-start";
import type { DeliveryStats, IndividualOrder, Workspace } from "@/types/database";
import { autoAssignMissingSuppliersFromCatalog } from "@/lib/services/auto-assign-suppliers";

import type { Metadata } from "next";
import { pageMetadataFor } from "@/lib/ui/page-metadata";

export const metadata: Metadata = pageMetadataFor("moje");

export default async function MojePage({
  searchParams,
}: {
  searchParams: Promise<{
    dla?: string;
    klient?: string;
    q?: string;
    kh?: string;
    zkWatch?: string;
    zk?: string;
    focusOrders?: string;
    ogloszenie?: string;
  }>;
}) {
  const {
    dla: previewSalesPersonId,
    klient: clientQuery,
    q: searchQuery,
    kh: khParam,
    zkWatch: zkWatchParam,
    zk: zkNumberParam,
    focusOrders: focusOrdersParam,
    ogloszenie: focusAnnouncementParam,
  } = await searchParams;
  const parsedKh = khParam ? Math.trunc(Number(khParam)) : null;
  const initialClientKhId =
    parsedKh != null && Number.isFinite(parsedKh) && parsedKh > 0 ? parsedKh : null;
  const hasNotepadClientLink =
    initialClientKhId != null ||
    Boolean(zkWatchParam?.trim()) ||
    Boolean(zkNumberParam?.trim());
  const initialSearchQuery = hasNotepadClientLink
    ? (searchQuery?.trim() || null)
    : (searchQuery ?? clientQuery)?.trim() || null;
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
  let boardAttention: SalesBoardAttentionSnapshot | null = null;
  let dayStartContext: SalesDayStartContext | null = null;
  let boardAnnouncements: DepartmentBoardAnnouncementsSlice | null = null;

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

        // Pobierz aktywne delegacje dla przełącznika (zastępca)
        if (user.role === "sales" || user.role === "sales_manager") {
          try {
            activeDelegations = await fetchActiveDelegationsForDelegate(user.id);
          } catch {}
        }

        // Sprawdzenie delegacji — przed blokiem błędu ?dla= dla sales
        if (
          user.role === "sales" &&
          previewSalesPersonId &&
          previewSalesPersonId !== ownSalesPersonId
        ) {
          const delegatePreview = await resolveDelegatePreviewSalesPerson(
            previewSalesPersonId,
            user
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

  if (role && isSalesAccount(role) && linkError && !previewSalesPersonId) {
    return (
      <div className={salesPageShellClass}>
        <SalesAccountLinkRequired
          title="Moje zamówienia"
          hint="Tutaj śledzisz status prośb. Konto musi być przypisane do Twojego profilu handlowca."
        />
      </div>
    );
  }

  let orders: IndividualOrder[] = [];
  let stats: DeliveryStats[] = [];
  let suppliers: OrderFormSupplierOption[] = [];
  let archiwumRecent: ReturnType<typeof presentArchivedMyOrders> = [];
  let archiwumExtended: ReturnType<typeof presentArchivedMyOrders> = [];
  let supplierScheduleById: Awaited<
    ReturnType<typeof loadPlannedOrderScheduleContext>
  >["supplierScheduleById"] = {};
  let plannedOrderWeekDays: Awaited<
    ReturnType<typeof loadPlannedOrderScheduleContext>
  >["weekDays"] = [];
  let loadError: string | null = null;
  const todayDateKey = formatDateString(todayInWarsaw());

  const viewingOwnPanel =
    isSalesAccount(role ?? "sales") && salesPersonId && salesPersonId === ownSalesPersonId;

  const delegatePreviewActive = isDelegatePreview && salesPersonId && salesPersonId !== ownSalesPersonId;

  const adminSalesPreview = Boolean(role === "admin" && previewSalesPersonId && salesPersonId);
  const salesPanelView =
    (isSalesAccount(role ?? "sales") && salesPersonId) || adminSalesPreview;
  /** Ogłoszenia są działowe — pokazuj zalogowanemu użytkownikowi (także w podglądzie ?dla=). */
  const loadMojeAnnouncements = Boolean(
    sessionUserId && (isSalesAccount(role ?? "sales") || adminSalesPreview)
  );
  let boardAnnouncementsError: string | null = null;
  /** Własny panel lub podgląd cudzego konta (kierownik / admin) — ten sam widok listy + archiwum RO. */
  const showSalesPersonOrdersPanel = Boolean(
    salesPanelView && salesPersonId && (viewingOwnPanel || isTeamPreview || delegatePreviewActive)
  );

  let notepadSlice: Awaited<ReturnType<typeof fetchSalesDayStartNotepadSlice>> | null = null;

  try {
    if (salesPanelView && salesPersonId) {
      const [orderRows, statsRows, acknowledgedRows_, supplierRows, boardSnap, notepadData, announcementsSlice] =
        await Promise.all([
        fetchIndividualOrders({
          salesPersonId,
          hideSalesAcknowledged: false,
        }),
        fetchDeliveryStats(),
        viewingOwnPanel || isTeamPreview || delegatePreviewActive
          ? fetchSalesAcknowledgedOrders(salesPersonId, {
              acknowledgedSince: archiveAcknowledgedSinceExpanded(),
              limit: 200,
            })
          : Promise.resolve([]),
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
      boardAttention = boardSnap;
      boardAnnouncements = announcementsSlice;
      notepadSlice = notepadData;
      orders = orderRows;
      stats = statsRows as DeliveryStats[];
      suppliers = supplierRows;
      if (orders.some((o) => o.is_teeth)) {
        const { attachTeethDetailsToIndividualOrders } = await import("@/lib/data/teeth-queue");
        orders = await attachTeethDetailsToIndividualOrders(orders);
      }
      ({ supplierScheduleById, weekDays: plannedOrderWeekDays } =
        await loadPlannedOrderScheduleContext(orderRows, todayDateKey));

      // Sync terminów ZD — tylko klient (MojeZdEtaSyncClient, live search + force).
      // Robimy to po pobraniu, żeby pierwszy render był szybki.
      const missing = orderRows.filter((o) => !o.supplier_id && o.subiekt_tw_id);
      if (missing.length > 0 && !adminSalesPreview) {
        const { after } = await import("next/server");
        after(async () => {
          try {
            await autoAssignMissingSuppliersFromCatalog({
              salesPersonId,
              limit: 80,
            });
          } catch (e) {
            console.error("[autoAssignMissingSuppliersFromCatalog moje]", e);
          }
        });
      }
      if (showSalesPersonOrdersPanel) {
        if (acknowledgedRows.some((o) => o.is_teeth)) {
          const { attachTeethDetailsToIndividualOrders } = await import("@/lib/data/teeth-queue");
          acknowledgedRows = await attachTeethDetailsToIndividualOrders(acknowledgedRows);
        }
        const legacyUnackedCancelled = orderRows.filter(
          (o) => o.status === "Anulowane" && !o.sales_acknowledged_at
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
    } else if (role && canAccessOperations(role, workspaces) && salesPersonId) {
      const [orderRows, statsRows, supplierRows] = await Promise.all([
        fetchIndividualOrders({ salesPersonId }),
        fetchDeliveryStats(),
        fetchSuppliersForRequestForms(),
      ]);
      orders = orderRows;
      stats = statsRows as DeliveryStats[];
      suppliers = supplierRows;
      if (orders.some((o) => o.is_teeth)) {
        const { attachTeethDetailsToIndividualOrders } = await import("@/lib/data/teeth-queue");
        orders = await attachTeethDetailsToIndividualOrders(orders);
      }
      ({ supplierScheduleById, weekDays: plannedOrderWeekDays } =
        await loadPlannedOrderScheduleContext(orderRows, todayDateKey));

      const missing = orderRows.filter((o) => !o.supplier_id && o.subiekt_tw_id);
      if (missing.length > 0) {
        const { after } = await import("next/server");
        after(async () => {
          try {
            await autoAssignMissingSuppliersFromCatalog({
              salesPersonId: salesPersonId ?? undefined,
              limit: 120,
            });
          } catch (e) {
            console.error("[autoAssignMissingSuppliersFromCatalog ops moje]", e);
          }
        });
      }
    }
  } catch (e) {
    loadError = e instanceof Error ? e.message : "Nie udało się załadować zamówień.";
  }

  const subiektAvailability = await getSubiektAvailability();
  const subiektReachable = isSubiektAvailableForZdSync(subiektAvailability);

  const supplierRefs = showSalesPersonOrdersPanel ? await getAppSupplierRefsCached() : [];
  const supplierKhIdsBySupplierId = buildSupplierKhIdsBySupplierId(supplierRefs);
  const zdEtaSyncMountCount =
    viewingOwnPanel ? countZdEtaMojeClientSyncMount(orders, stats, supplierRefs) : 0;
  const zdEtaSyncEligibleCount =
    viewingOwnPanel && subiektReachable
      ? countZdEtaMojeClientSyncTriggers(orders, stats, supplierRefs, subiektReachable)
      : 0;

  const { zamowienia, informacje, productLineCount } = presentMyOrders(orders, stats, {
    supplierScheduleById,
    todayDateKey,
    weekDays: plannedOrderWeekDays,
    supplierKhIdsBySupplierId,
    subiektReachable,
  });

  if (viewingOwnPanel && notepadSlice) {
    /** Start dnia = własna kolejka akcji (zamówienia + notatnik + tablica zalogowanego użytkownika). */
    dayStartContext = {
      watches: notepadSlice.zkWatches,
      notes: notepadSlice.notes,
      boardAttention,
      previewDla: previewSalesPersonId ?? null,
    };
  }

  const salesHeaderActions =
    role && !canAccessOperations(role, workspaces) ? (
      !isTeamPreview && !isDelegatePreview ? (
        <Link
          href="/prosba"
          className={cn(
            buttonPrimaryClass,
            pageToolbarSizingClass,
            "hidden rounded-md font-medium no-underline sm:inline-flex"
          )}
        >
          Zgłoś prośbę
        </Link>
      ) : null
    ) : undefined;

  const showSalesSync = Boolean(
    !adminSalesPreview && !isDelegatePreview && (role && !canAccessOperations(role, workspaces))
  );

  const activeDelegationForRow = isDelegatePreview && salesPersonId
    ? activeDelegations.find((d) => d.salesPersonId === salesPersonId)
    : null;

  return (
    <div className={salesPageShellClass}>
      <SalesPageAlerts
        teamPreview={
          isTeamPreview && salesPersonId && salesPersonName
            ? {
                salesPersonId,
                salesPersonName,
                readOnly: adminSalesPreview,
                scope: "orders",
              }
            : isDelegatePreview && salesPersonId && salesPersonName
              ? {
                  salesPersonId,
                  salesPersonName,
                  readOnly: false,
                  scope: "orders",
                  isDelegate: true,
                  startDate: activeDelegationForRow?.startDate ?? null,
                  endDate: activeDelegationForRow?.endDate ?? null,
                }
              : null
        }
        linkError={linkError}
        showLinkError={Boolean(linkError && previewSalesPersonId)}
      />

      {loadError ? (
        <Alert tone="error">{loadError}</Alert>
      ) : null}

      {viewingOwnPanel && !isTeamPreview && !isDelegatePreview ? (
        <div className="flex justify-end pb-1">
          <Link
            href="/ustawienia"
            className="text-xs font-medium text-slate-400 underline decoration-slate-300/60 underline-offset-2 transition-colors hover:text-slate-600"
          >
            Ustawienia i urlopy →
          </Link>
        </div>
      ) : null}

      {role && canAccessOperations(role, workspaces) && !salesPersonId && isAdmin(role ?? "admin") ? (
        <SystemNotice
          variant="action"
          className="mb-4"
          title="Widok wszystkich prośb"
          description="To lista operacyjna — nie panel pojedynczego handlowca. Aby zobaczyć konto handlowca, użyj podglądu."
          href="/admin/wybor-handlowca"
          actionLabel="Wybierz handlowca"
        />
      ) : role && canAccessOperations(role, workspaces) && !salesPersonId ? (
        <Alert tone="warning" className="mb-4">
          Tryb operacyjny — widzisz wszystkie zamówienia we wszystkich kontach handlowców.
        </Alert>
      ) : null}

      <MojeOrdersShell
        initial={{ zamowienia, informacje, productLineCount }}
        salesPersonId={salesPersonId}
        pageTitle={isTeamPreview ? `Prośby: ${salesPersonName}` : isDelegatePreview ? `Zastępujesz: ${salesPersonName}` : "Moje zamówienia"}
        pageDescription={
          isTeamPreview
            ? "Podgląd prośb wybranego handlowca — statusy i odbiór."
            : isDelegatePreview
              ? "Tryb zastępstwa — potwierdzenie odbioru i zamknięcie ZK aktywne. Edycja i anulowanie są wyłączone."
              : undefined
        }
        headerActions={salesHeaderActions}
        archiwumRecent={showSalesPersonOrdersPanel ? archiwumRecent : []}
        archiwumExtended={showSalesPersonOrdersPanel ? archiwumExtended : []}
        canAcknowledge={!!viewingOwnPanel || isDelegatePreview}
        canEdit={!!viewingOwnPanel}
        showProsbaCta={isSalesAccount(role ?? "sales") && !isTeamPreview && !isDelegatePreview}
        suppliers={suppliers}
        subiektAvailability={subiektAvailability}
        initialSearchQuery={initialSearchQuery}
        initialClientKhId={initialClientKhId}
        initialClientKhLabel={clientQuery?.trim() || null}
        initialClientZkWatchId={zkWatchParam?.trim() || null}
        initialClientZkNumber={zkNumberParam?.trim() || null}
        initialFocusOrderIds={focusOrdersParam?.trim() || null}
        syncSearchUrl={!isTeamPreview && !isDelegatePreview}
        showSalesSync={showSalesSync}
        zdEtaSyncMountCount={zdEtaSyncMountCount}
        zdEtaSyncEligibleCount={zdEtaSyncEligibleCount}
        dayStartContext={isDelegatePreview ? null : dayStartContext}
        activeDelegations={activeDelegations}
        isDelegatePreview={isDelegatePreview}
        boardAnnouncements={boardAnnouncements}
        boardAnnouncementsError={boardAnnouncementsError}
        focusAnnouncementId={focusAnnouncementParam?.trim() || null}
      />
    </div>
  );
}
