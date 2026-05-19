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
import { getAppRole } from "@/lib/auth-dev";
import { canAccessOperations } from "@/lib/auth-roles";
import { presentMyOrders } from "@/lib/orders/my-order-presenter";
import Link from "next/link";
import { PageHeader } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";
import { MojeOrdersView } from "@/components/moje/MojeOrdersView";
import { MojePageSalesToolbar } from "@/components/moje/MojePageSalesToolbar";
import { SalesAccountLinkRequired } from "@/components/sales/SalesAccountLinkRequired";
import type { DeliveryStats, IndividualOrder } from "@/types/database";

export default async function MojePage() {
  const role = await getAppRole();
  let salesPersonId: string | null = null;
  let salesPersonName: string | null = null;
  let linkError: string | null = null;

  try {
    const user = await getSessionUser();
    if (user?.role === "sales") {
      const resolved = await resolveSalesPersonForUser(user);
      salesPersonId = resolved?.id ?? null;
      salesPersonName = resolved?.name ?? null;
      if (!salesPersonId) {
        linkError =
          "Twoje konto nie jest powiązane z kartą handlowca. Poproś administratora o nowy link zaproszenia (Admin → Handlowcy).";
      }
    } else {
      salesPersonId = user?.salesPersonId ?? null;
    }
  } catch {
    /* dev */
  }

  if (role === "sales" && linkError) {
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

  try {
    if (role === "sales" && salesPersonId) {
      const [orderRows, statsRows, acknowledgedRows, supplierRows] = await Promise.all([
        fetchIndividualOrders({
          salesPersonId,
          hideSalesAcknowledged: false,
        }),
        fetchDeliveryStats(),
        fetchSalesAcknowledgedOrders(salesPersonId, {
          acknowledgedSince: archiveAcknowledgedSinceExpanded(),
          limit: 200,
        }),
        fetchSuppliersWithSchedules(),
      ]);
      orders = orderRows;
      stats = statsRows as DeliveryStats[];
      suppliers = supplierRows.map((s) => ({ id: s.id, name: s.name }));
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
    } else if (role && canAccessOperations(role)) {
      const [orderRows, statsRows, supplierRows] = await Promise.all([
        fetchIndividualOrders(
          salesPersonId ? { salesPersonId } : undefined
        ),
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

  const { zamowienia, informacje, productLineCount } = presentMyOrders(orders, stats);

  return (
    <>
      <PageHeader
        title="Moje zamówienia"
        description={
          salesPersonName
            ? `Status prośb i odbiór z magazynu — najpierw to, co wymaga Twojej akcji (${salesPersonName}).`
            : "Status prośb, postęp na magazynie i potwierdzenie odbioru towaru."
        }
        actions={
          role && !canAccessOperations(role) ? (
            <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
              <MojePageSalesToolbar />
              <Link href="/prosba" className="hidden sm:block">
                <Button className="w-full sm:w-auto">Zgłoś prośbę</Button>
              </Link>
            </div>
          ) : undefined
        }
      />

      {loadError ? (
        <Alert tone="error" className="mb-6">
          {loadError}
        </Alert>
      ) : null}

      {role && canAccessOperations(role) && !salesPersonId ? (
        <Alert tone="warning" className="mb-6">
          Tryb administratora — widzisz wszystkie zamówienia.
        </Alert>
      ) : null}

      <MojeOrdersView
        zamowienia={zamowienia}
        informacje={informacje}
        archiwumRecent={role === "sales" ? archiwumRecent : []}
        archiwumExtended={role === "sales" ? archiwumExtended : []}
        productLineCount={productLineCount}
        canAcknowledge={role === "sales" && !!salesPersonId}
        showProsbaCta={role === "sales"}
        suppliers={suppliers}
      />
    </>
  );
}
