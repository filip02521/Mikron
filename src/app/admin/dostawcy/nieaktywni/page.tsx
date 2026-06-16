import { countInactiveSuppliers, fetchSuppliersWithSchedules } from "@/lib/data/queries";
import { fetchWarehouseCarriers } from "@/lib/data/warehouse-carriers";
import { InactiveSuppliersAdminClient } from "@/components/admin/InactiveSuppliersAdminClient";
import { SuppliersHubShell } from "@/components/admin/SuppliersHubShell";
import { Alert } from "@/components/ui/Alert";
import { supplierHubShellDescription } from "@/lib/supplier-hub";

import type { Metadata } from "next";
import { pageMetadataFor } from "@/lib/ui/page-metadata";

export const metadata: Metadata = pageMetadataFor("inactiveSuppliers");

export default async function NieaktywniAdminPage() {
  let suppliers: Awaited<ReturnType<typeof fetchSuppliersWithSchedules>> = [];
  let inactiveCount = 0;
  let warehouseCarriers: Awaited<ReturnType<typeof fetchWarehouseCarriers>> = [];
  let loadError: string | null = null;
  try {
    [suppliers, inactiveCount, warehouseCarriers] = await Promise.all([
      fetchSuppliersWithSchedules(undefined, { inactiveOnly: true }),
      countInactiveSuppliers(),
      fetchWarehouseCarriers(),
    ]);
  } catch (e) {
    loadError = e instanceof Error ? e.message : "Nie udało się wczytać listy nieaktywnych dostawców.";
    suppliers = [];
  }

  return (
    <SuppliersHubShell
      title="Nieaktywni dostawcy"
      description={supplierHubShellDescription("inactive", "admin")}
      activeTab="inactive"
      context="admin"
      inactiveCount={inactiveCount}
    >
      {loadError ? <Alert tone="error">{loadError}</Alert> : null}
      <InactiveSuppliersAdminClient
        initial={suppliers}
        context="admin"
        warehouseCarriers={warehouseCarriers}
      />
    </SuppliersHubShell>
  );
}
