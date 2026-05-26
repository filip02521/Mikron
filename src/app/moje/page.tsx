import {
  fetchDeliveryStats,
  fetchIndividualOrders,
  fetchSalesAcknowledgedOrders,
  fetchSuppliersWithSchedules,
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
import { resolveSubiektZdEtasForOrders, type SubiektZdEta } from "@/lib/subiekt/zd-eta";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";
import { MojeOrdersView } from "@/components/moje/MojeOrdersView";
import { MojePageSalesToolbar } from "@/components/moje/MojePageSalesToolbar";
import { SalesAccountLinkRequired } from "@/components/sales/SalesAccountLinkRequired";
import { ManagerPreviewBanner } from "@/components/sales/ManagerPreviewBanner";
import type { DeliveryStats, IndividualOrder } from "@/types/database";

export default async function MojePage({
  searchParams,
}: {
  searchParams: Promise<{ dla?: string }>;
}) {
  const { dla: previewSalesPersonId } = await searchParams;
  const role = await getAppRole();
  let salesPersonId: string | null = null;
  let salesPersonName: string | null = null;
  let ownSalesPersonId: string | null = null;
  let linkError: string | null = null;
  let isTeamPreview = false;

  try {
    const user = await getSessionUser();
    if (user && isSalesAccount(user.role)) {
      const own = await resolveSalesPersonForUser(user);
      ownSalesPersonId = own?.id ?? null;
      if (isSalesManager(user.role) && previewSalesPersonId) {
        const preview = await resolvePreviewSalesPerson(previewSalesPersonId);
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
          "Twoje konto nie jest powiązane z kartą handlowca. Poproś administratora o nowy link zaproszenia (Admin → Handlowcy).";
      }
      if (!ownSalesPersonId && user.role === "sales_manager") {
        linkError =
          "Twoje konto kierownika nie jest powiązane z kartą handlowca — poproś administratora o przypisanie w panelu użytkowników.";
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
        description="Tutaj śledzisz status prośb — wymagane powiązanie konta z kartą handlowca."
      />
    );
  }

  let orders: IndividualOrder[] = [];
  let stats: DeliveryStats[] = [];
  let suppliers: { id: string; name: string }[] = [];
  let archiwumRecent: ReturnType<typeof presentArchivedMyOrders> = [];
  let archiwumExtended: ReturnType<typeof presentArchivedMyOrders> = [];
  let loadError: string | null = null;

  const viewingOwnPanel =
    isSalesAccount(role ?? "sales") && salesPersonId && salesPersonId === ownSalesPersonId;

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
        fetchSuppliersWithSchedules(),
      ]);
      orders = orderRows;
      stats = statsRows as DeliveryStats[];
      suppliers = supplierRows.map((s) => ({ id: s.id, name: s.name }));
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
        fetchSuppliersWithSchedules(),
      ]);
      orders = orderRows;
      stats = statsRows as DeliveryStats[];
      suppliers = supplierRows.map((s) => ({ id: s.id, name: s.name }));
    }
  } catch (e) {
    loadError = e instanceof Error ? e.message : "Nie udało się załadować zamówień.";
  }

  const subiektAvailability = await getSubiektAvailability();

  let zdEtaByOrderId: Record<string, SubiektZdEta> = {};
  if (subiektAvailability.reachable) {
    try {
      zdEtaByOrderId = await resolveSubiektZdEtasForOrders(orders);
    } catch {
      /* pojedynczy błąd ZD — zostaje szacunek z historii */
    }
  }

  const { zamowienia, informacje, productLineCount } = presentMyOrders(
    orders,
    stats,
    zdEtaByOrderId
  );

  const salesHeaderActions =
    role && !canAccessOperations(role) ? (
      <>
        <MojePageSalesToolbar />
        {!isTeamPreview ? (
          <Link href="/prosba" className="hidden sm:inline-flex">
            <Button size="sm">Zgłoś prośbę</Button>
          </Link>
        ) : null}
      </>
    ) : undefined;

  return (
    <div className="mx-auto max-w-3xl space-y-4">
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

      {loadError ? (
        <Alert tone="error">{loadError}</Alert>
      ) : null}

      {role && canAccessOperations(role) && !salesPersonId ? (
        <Alert tone="warning">
          Tryb administratora — widzisz wszystkie zamówienia.
        </Alert>
      ) : null}

      <MojeOrdersView
        pageTitle={isTeamPreview ? `Panel: ${salesPersonName}` : "Moje zamówienia"}
        pageDescription={
          isTeamPreview
            ? `Podgląd prośb handlowca — statusy i odbiór.`
            : undefined
        }
        headerActions={salesHeaderActions}
        zamowienia={zamowienia}
        informacje={informacje}
        archiwumRecent={viewingOwnPanel ? archiwumRecent : []}
        archiwumExtended={viewingOwnPanel ? archiwumExtended : []}
        productLineCount={productLineCount}
        canAcknowledge={!!viewingOwnPanel}
        showProsbaCta={isSalesAccount(role ?? "sales") && !isTeamPreview}
        suppliers={suppliers}
        subiektAvailability={subiektAvailability}
      />
    </div>
  );
}
