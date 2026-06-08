import { countInactiveSuppliers, fetchSuppliersWithSchedules } from "@/lib/data/queries";
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
  let loadError: string | null = null;
  try {
    [suppliers, inactiveCount] = await Promise.all([
      fetchSuppliersWithSchedules(),
      countInactiveSuppliers(),
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
      <SuppliersAdminClient initial={suppliers} allowDelete />
    </SuppliersHubShell>
  );
}
