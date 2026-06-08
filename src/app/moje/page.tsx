import {
  fetchDeliveryStats,
  fetchIndividualOrders,
  fetchSalesAcknowledgedOrders,
  fetchSuppliersForRequestForms,
} from "@/lib/data/queries";
import {
  ARCHIVE_EXPANDED_GROUP_LIMIT,
  archiveAcknowledgedSinceExpanded,
  archiveAcknowledgedSinceRecent,
  presentArchivedMyOrders,
} from "@/lib/orders/my-order-archive";
import { getSessionUser } from "@/lib/auth";
import { resolveSalesPersonForUser } from "@/lib/auth/sales-person";
import { resolvePreviewSalesPerson } from "@/lib/auth/resolve-preview-sales-person";
import { getAppRole } from "@/lib/auth-dev";
import { canAccessOperations, isSalesAccount, isSalesManager } from "@/lib/auth-roles";
import { presentMyOrders } from "@/lib/orders/my-order-presenter";
import { getSubiektAvailability } from "@/lib/subiekt/availability";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";
import { MojeOrdersShell } from "@/components/moje/MojeOrdersShell";
import type { OrderFormSupplierOption } from "@/lib/orders/order-form-suppliers";
import { salesPageShellClass, pageToolbarSizingClass } from "@/lib/ui/ontime-theme";
import { SalesAccountLinkRequired } from "@/components/sales/SalesAccountLinkRequired";
import { ManagerPreviewBanner } from "@/components/sales/ManagerPreviewBanner";
import { DepartmentBoardSalesAttention } from "@/components/department-board/DepartmentBoardSalesAttention";
import {
  fetchSalesBoardAttentionSnapshot,
  type SalesBoardAttentionSnapshot,
} from "@/lib/data/department-board";
import type { DeliveryStats, IndividualOrder } from "@/types/database";
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
  }>;
}) {
  const {
    dla: previewSalesPersonId,
    klient: clientQuery,
    q: searchQuery,
    kh: khParam,
    zkWatch: zkWatchParam,
    zk: zkNumberParam,
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
  let salesPersonId: string | null = null;
  let salesPersonName: string | null = null;
  let ownSalesPersonId: string | null = null;
  let linkError: string | null = null;
  let isTeamPreview = false;
  let sessionUserId: string | null = null;
  let boardAttention: SalesBoardAttentionSnapshot | null = null;

  try {
    const user = await getSessionUser();
    sessionUserId = user?.id ?? null;
    if (user && isSalesAccount(user.role)) {
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
  } catch {
    /* dev */
  }

  if (role && isSalesAccount(role) && linkError && !previewSalesPersonId) {
    return (
      <SalesAccountLinkRequired
        title="Moje zamówienia"
        description="Tutaj śledzisz status prośb. Konto musi być przypisane do Twojego profilu handlowca."
      />
    );
  }

  let orders: IndividualOrder[] = [];
  let stats: DeliveryStats[] = [];
  let suppliers: OrderFormSupplierOption[] = [];
  let archiwumRecent: ReturnType<typeof presentArchivedMyOrders> = [];
  let archiwumExtended: ReturnType<typeof presentArchivedMyOrders> = [];
  let loadError: string | null = null;

  const viewingOwnPanel =
    isSalesAccount(role ?? "sales") && salesPersonId && salesPersonId === ownSalesPersonId;

  if (viewingOwnPanel && sessionUserId) {
    try {
      boardAttention = await fetchSalesBoardAttentionSnapshot(sessionUserId);
    } catch {
      /* banner opcjonalny */
    }
  }

  try {
    if (isSalesAccount(role ?? "sales") && salesPersonId) {
      const [orderRows, statsRows, acknowledgedRows, supplierRows] = await Promise.all([
        fetchIndividualOrders({
          salesPersonId,
          hideSalesAcknowledged: false,
        }),
        fetchDeliveryStats(),
        viewingOwnPanel
          ? fetchSalesAcknowledgedOrders(salesPersonId, {
              acknowledgedSince: archiveAcknowledgedSinceExpanded(),
              limit: 200,
            })
          : Promise.resolve([]),
        fetchSuppliersForRequestForms(),
      ]);
      orders = orderRows;
      stats = statsRows as DeliveryStats[];
      suppliers = supplierRows;

      // Auto-uzupełnianie dostawcy w tle na podstawie własnej bazy mapowań (product_supplier_links).
      // Robimy to po pobraniu, żeby pierwszy render był szybki.
      const missing = orderRows.filter((o) => !o.supplier_id && o.subiekt_tw_id);
      if (missing.length > 0) {
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
      if (viewingOwnPanel) {
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
    } else if (role && canAccessOperations(role)) {
      const [orderRows, statsRows, supplierRows] = await Promise.all([
        fetchIndividualOrders(salesPersonId ? { salesPersonId } : undefined),
        fetchDeliveryStats(),
        fetchSuppliersForRequestForms(),
      ]);
      orders = orderRows;
      stats = statsRows as DeliveryStats[];
      suppliers = supplierRows;

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

  const { zamowienia, informacje, productLineCount } = presentMyOrders(orders, stats);

  const salesHeaderActions =
    role && !canAccessOperations(role) ? (
      !isTeamPreview ? (
        <Link href="/prosba" className="hidden sm:inline-flex sm:items-center">
          <Button size="sm" className={pageToolbarSizingClass}>
            Zgłoś prośbę
          </Button>
        </Link>
      ) : null
    ) : undefined;

  const showSalesSync = Boolean(role && !canAccessOperations(role));

  return (
    <div className={salesPageShellClass}>
      {linkError && previewSalesPersonId ? (
        <Alert tone="error">
          {linkError}
        </Alert>
      ) : null}

      {isTeamPreview && salesPersonId && salesPersonName ? (
        <ManagerPreviewBanner
          salesPersonId={salesPersonId}
          salesPersonName={salesPersonName}
        />
      ) : null}

      {viewingOwnPanel && boardAttention ? (
        <DepartmentBoardSalesAttention attention={boardAttention} showPinned={false} />
      ) : null}

      {loadError ? (
        <Alert tone="error">{loadError}</Alert>
      ) : null}

      {role && canAccessOperations(role) && !salesPersonId ? (
        <Alert tone="warning">
          Tryb administratora — widzisz wszystkie zamówienia.
        </Alert>
      ) : null}

      <MojeOrdersShell
        initial={{ zamowienia, informacje, productLineCount }}
        salesPersonId={salesPersonId}
        pageTitle={isTeamPreview ? `Prośby: ${salesPersonName}` : "Moje zamówienia"}
        pageDescription={
          isTeamPreview
            ? "Podgląd prośb wybranego handlowca — statusy i odbiór."
            : undefined
        }
        headerActions={salesHeaderActions}
        archiwumRecent={viewingOwnPanel ? archiwumRecent : []}
        archiwumExtended={viewingOwnPanel ? archiwumExtended : []}
        canAcknowledge={!!viewingOwnPanel}
        showProsbaCta={isSalesAccount(role ?? "sales") && !isTeamPreview}
        suppliers={suppliers}
        subiektAvailability={subiektAvailability}
        initialSearchQuery={initialSearchQuery}
        initialClientKhId={initialClientKhId}
        initialClientKhLabel={clientQuery?.trim() || null}
        initialClientZkWatchId={zkWatchParam?.trim() || null}
        initialClientZkNumber={zkNumberParam?.trim() || null}
        syncSearchUrl={!isTeamPreview}
        showSalesSync={showSalesSync}
      />
    </div>
  );
}
