import { presentMyOrders } from "@/lib/orders/my-order-presenter";
import { getSubiektAvailability, isSubiektAvailableForZdSync } from "@/lib/subiekt/availability";
import {
  countZdEtaMojeClientSyncMount,
  countZdEtaMojeClientSyncTriggers,
} from "@/lib/subiekt/zd-eta-sync";
import { getAppSupplierRefsCached } from "@/lib/data/supplier-refs";
import { buildSupplierKhIdsBySupplierId } from "@/lib/data/supplier-subiekt-kh";
import Link from "next/link";
import { Alert } from "@/components/ui/Alert";
import { MojeOrdersShell } from "@/components/moje/MojeOrdersShell";
import {
  buttonPrimaryClass,
  pageToolbarSizingClass,
  salesPageShellClass,
} from "@/lib/ui/ontime-theme";
import { cn } from "@/lib/cn";
import { DelegateModeBackground } from "@/components/moje/DelegatePreviewContext";
import { SalesAccountLinkRequired } from "@/components/sales/SalesAccountLinkRequired";
import { SalesPageAlerts } from "@/components/sales/SalesPageAlerts";
import { SystemNotice } from "@/components/ui/SystemNotice";
import { canAccessOperations, isAdmin, isSalesAccount } from "@/lib/auth-roles";
import {
  resolveMojePageContext,
  loadMojePageData,
  buildDayStartContext,
} from "@/lib/orders/moje-page-helpers";
import { formatDateString } from "@/lib/orders/dates";
import { todayInWarsaw } from "@/lib/time/warsaw";
import { IconSettings } from "@/components/icons/StrokeIcons";

import type { Metadata } from "next";
import { pageMetadataFor } from "@/lib/ui/page-metadata";

export const metadata: Metadata = pageMetadataFor("moje");
export const dynamic = "force-dynamic";

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
  const ctx = await resolveMojePageContext(previewSalesPersonId);
  const {
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
  } = ctx;

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

  const viewingOwnPanel = Boolean(
    isSalesAccount(role ?? "sales") && salesPersonId && salesPersonId === ownSalesPersonId
  );

  const delegatePreviewActive = Boolean(
    isDelegatePreview && salesPersonId && salesPersonId !== ownSalesPersonId
  );

  const adminSalesPreview = Boolean(role === "admin" && previewSalesPersonId && salesPersonId);
  const salesPanelView = Boolean(
    (isSalesAccount(role ?? "sales") && salesPersonId) || adminSalesPreview
  );
  const loadMojeAnnouncements = Boolean(
    sessionUserId && (isSalesAccount(role ?? "sales") || adminSalesPreview)
  );
  const showSalesPersonOrdersPanel = Boolean(
    salesPanelView && salesPersonId && (viewingOwnPanel || isTeamPreview || delegatePreviewActive)
  );

  const data = await loadMojePageData(ctx, {
    salesPanelView,
    viewingOwnPanel,
    isTeamPreview,
    delegatePreviewActive,
    adminSalesPreview,
    showSalesPersonOrdersPanel,
    loadMojeAnnouncements,
  });

  const {
    orders,
    stats,
    suppliers,
    archiwumRecent,
    archiwumExtended,
    supplierScheduleById,
    plannedOrderWeekDays,
    boardAttention,
    boardAnnouncements,
    boardAnnouncementsError,
    notepadSlice,
    loadError,
  } = data;

  let subiektAvailability: Awaited<ReturnType<typeof getSubiektAvailability>>;
  try {
    subiektAvailability = await getSubiektAvailability();
  } catch {
    subiektAvailability = {
      configured: false,
      reachable: false,
      checkedAt: 0,
      shortLabel: "System magazynowy: niedostępny",
      message: "Nie udało się sprawdzić połączenia z systemem magazynowym.",
    };
  }
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
    todayDateKey: formatDateString(todayInWarsaw()),
    weekDays: plannedOrderWeekDays,
    supplierKhIdsBySupplierId,
    subiektReachable,
  });

  const dayStartContext = buildDayStartContext(
    Boolean(viewingOwnPanel),
    notepadSlice,
    boardAttention,
    previewSalesPersonId,
  );

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
    <DelegateModeBackground active={isDelegatePreview || isTeamPreview} label={salesPersonName} className={salesPageShellClass}>
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
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200/80 bg-white/60 px-3 py-1.5 text-xs font-medium text-slate-500 shadow-sm transition-all hover:border-slate-300 hover:bg-white hover:text-slate-700 hover:shadow"
          >
            <IconSettings size={14} className="shrink-0 text-slate-400" />
            Ustawienia
          </Link>
        </div>
      ) : null}

      {role != null && canAccessOperations(role, workspaces) && !salesPersonId && isAdmin(role) ? (
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
    </DelegateModeBackground>
  );
}
