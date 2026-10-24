import { userFacingErrorText } from "@/lib/ui/user-facing-error";
import { countInactiveSuppliers, fetchSuppliersWithSchedules } from "@/lib/data/queries";
import { fetchWarehouseCarriers } from "@/lib/data/warehouse-carriers";
import { SuppliersAdminClient } from "@/components/admin/SuppliersAdminClient";
import { loadZdAutomatSuppliersForCards } from "@/lib/data/zd-automat-suppliers";
import { SuppliersHubShell } from "@/components/admin/SuppliersHubShell";
import { Alert } from "@/components/ui/Alert";
import { supplierHubShellDescription } from "@/lib/supplier-hub";
import type { SupplierWithSchedule } from "@/types/database";

import type { Metadata } from "next";
import { pageMetadataFor } from "@/lib/ui/page-metadata";

export const metadata: Metadata = pageMetadataFor("adminSuppliers");

export default async function DostawcyAdminPage() {
  let suppliers: SupplierWithSchedule[] = [];
  let inactiveCount = 0;
  let warehouseCarriers: Awaited<ReturnType<typeof fetchWarehouseCarriers>> = [];
  let automat: Awaited<ReturnType<typeof loadZdAutomatSuppliersForCards>> = {};
  let loadError: string | null = null;
  try {
    // /admin/dostawcy to strona tylko dla admina (layout) — admin ma Kreator ZD.
    [suppliers, inactiveCount, warehouseCarriers, automat] = await Promise.all([
      fetchSuppliersWithSchedules(),
      countInactiveSuppliers(),
      fetchWarehouseCarriers(),
      loadZdAutomatSuppliersForCards(true),
    ]);
  } catch (e) {
    loadError = userFacingErrorText(e, "Nie udało się wczytać listy dostawców.");
    suppliers = [];
  }

  return (
    <SuppliersHubShell
      title="Karty dostawców"
      description={supplierHubShellDescription("cards", "admin")}
      activeTab="cards"
      context="admin"
      inactiveCount={inactiveCount}
    >
      {loadError ? <Alert tone="error">{loadError}</Alert> : null}
      <SuppliersAdminClient initial={suppliers} allowDelete warehouseCarriers={warehouseCarriers} automat={automat} canManageAutomat />
    </SuppliersHubShell>
  );
}
