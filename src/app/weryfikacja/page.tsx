import { fetchSuppliersForRequestForms, fetchVerificationOrders } from "@/lib/data/queries";
import { runOrderMaintenanceBeforePageLoad } from "@/lib/services/deferred-order-maintenance";
import { fetchSalesPeopleForPicker } from "@/lib/data/sales-people-admin";
import { VerificationClient } from "@/components/verification/VerificationClient";
import { Alert } from "@/components/ui/Alert";
import { logDevPageError } from "@/lib/dev/log-page-error";
import { panelWorkspaceShellClass } from "@/lib/ui/ontime-theme";
import { cn } from "@/lib/cn";
import type { OrderFormSupplierOption } from "@/lib/orders/order-form-suppliers";
import type { IndividualOrder } from "@/types/database";

import type { Metadata } from "next";
import { pageMetadataFor } from "@/lib/ui/page-metadata";

export const metadata: Metadata = pageMetadataFor("weryfikacja");

export default async function WeryfikacjaPage() {
  await runOrderMaintenanceBeforePageLoad({ autoAssign: true });

  let orders: IndividualOrder[] = [];
  let suppliers: OrderFormSupplierOption[] = [];
  let salesPeople: { id: string; name: string }[] = [];
  let loadError: string | null = null;

  try {
    const [o, s] = await Promise.all([
      fetchVerificationOrders(),
      fetchSuppliersForRequestForms(),
    ]);
    orders = o;
    suppliers = s;
    salesPeople = await fetchSalesPeopleForPicker();
  } catch (error) {
    loadError = error instanceof Error ? error.message : "Nie udało się załadować weryfikacji.";
    logDevPageError("weryfikacja/page", error);
  }

  return (
    <>
      {loadError ? (
        <Alert tone="warning" className={cn(panelWorkspaceShellClass, "mb-4")}>
          {loadError}. Sprawdź połączenie z Supabase.
        </Alert>
      ) : null}
      <VerificationClient
      orders={orders}
      suppliers={suppliers}
      salesPeople={salesPeople.map((p) => ({ id: p.id, name: p.name }))}
    />
    </>
  );
}
