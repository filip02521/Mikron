import { countInactiveSuppliers, fetchSuppliersWithSchedules } from "@/lib/data/queries";
import { fetchWarehouseCarriers } from "@/lib/data/warehouse-carriers";
import { SuppliersAdminClient } from "@/components/admin/SuppliersAdminClient";
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
  let loadError: string | null = null;
  try {
    [suppliers, inactiveCount, warehouseCarriers] = await Promise.all([
      fetchSuppliersWithSchedules(),
      countInactiveSuppliers(),
      fetchWarehouseCarriers(),
    ]);
  } catch (e) {
    loadError = e instanceof Error ? e.message : "Nie udało się wczytać listy dostawców.";
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
      <SuppliersAdminClient initial={suppliers} allowDelete warehouseCarriers={warehouseCarriers} />
    </SuppliersHubShell>
  );
}
