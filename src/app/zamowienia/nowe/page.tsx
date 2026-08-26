import { userFacingErrorText } from "@/lib/ui/user-facing-error";
import { fetchSupplierFormContext, fetchSuppliersOnVacationNow } from "@/lib/data/queries";
import { fetchSalesPeopleForPicker } from "@/lib/data/sales-people-admin";
import { OrderFormClient } from "@/components/orders/OrderFormClient";
import { getAppRole } from "@/lib/auth-dev";
import { logDevPageError } from "@/lib/dev/log-page-error";
import { getSessionUser } from "@/lib/auth";
import { resolveSalesPersonForUser } from "@/lib/auth/sales-person";
import { Alert } from "@/components/ui/Alert";

import type { Metadata } from "next";
import { pageMetadataFor } from "@/lib/ui/page-metadata";
import { procurementArchivePageShellClass } from "@/lib/ui/ontime-theme";
import type { SupplierOnVacationWindow } from "@/lib/orders/procurement-supplier-vacation";

export const metadata: Metadata = pageMetadataFor("noweZamowienia");

export default async function NoweZamowieniePage() {
  const role = await getAppRole();
  let suppliers: Awaited<ReturnType<typeof fetchSupplierFormContext>>["suppliers"] = [];
  let statsBySupplierId: Awaited<
    ReturnType<typeof fetchSupplierFormContext>
  >["statsBySupplierId"] = {};
  let etaUseP50 = false;
  let etaQuantilesBySupplierId: Awaited<
    ReturnType<typeof fetchSupplierFormContext>
  >["etaQuantilesBySupplierId"] = {};
  let suppliersOnVacationNow: Record<string, SupplierOnVacationWindow> = {};
  let salesPeople: { id: string; name: string }[] = [];
  let loadError: string | null = null;
  try {
    const [ctx, onVacation] = await Promise.all([
      fetchSupplierFormContext(),
      fetchSuppliersOnVacationNow(),
    ]);
    suppliers = ctx.suppliers;
    statsBySupplierId = ctx.statsBySupplierId;
    etaUseP50 = ctx.etaUseP50;
    etaQuantilesBySupplierId = ctx.etaQuantilesBySupplierId;
    suppliersOnVacationNow = onVacation;
    salesPeople = await fetchSalesPeopleForPicker();
  } catch (error) {
    loadError = userFacingErrorText(error, "Nie udało się wczytać formularza.");
    logDevPageError("zamowienia/nowe/page", error);
  }

  let lockedSalesPerson: { id: string; name: string } | null = null;
  if (role === "sales") {
    try {
      const user = await getSessionUser();
      if (user) lockedSalesPerson = await resolveSalesPersonForUser(user);
    } catch (error) {
      logDevPageError("zamowienia/nowe/page:sales-person", error);
    }
  }

  return (
    <div className={procurementArchivePageShellClass}>
      {loadError ? <Alert tone="warning" className="mb-4">{loadError}</Alert> : null}
      <OrderFormClient
        suppliers={suppliers}
        salesPeople={salesPeople}
        lockedSalesPerson={lockedSalesPerson}
        suppliersOnVacationNow={suppliersOnVacationNow}
        statsBySupplierId={statsBySupplierId}
        etaUseP50={etaUseP50}
        etaQuantilesBySupplierId={etaQuantilesBySupplierId}
      />
    </div>
  );
}
