import { countInactiveSuppliers, fetchSuppliersWithSchedules } from "@/lib/data/queries";
import { InactiveSuppliersAdminClient } from "@/components/admin/InactiveSuppliersAdminClient";
import { SuppliersHubShell } from "@/components/admin/SuppliersHubShell";
import { Alert } from "@/components/ui/Alert";
import { supplierHubShellDescription } from "@/lib/supplier-hub";

import type { Metadata } from "next";
import { pageMetadataFor } from "@/lib/ui/page-metadata";

export const metadata: Metadata = pageMetadataFor("inactiveSuppliers");

export default async function NieaktywniZakupyPage() {
  let suppliers: Awaited<ReturnType<typeof fetchSuppliersWithSchedules>> = [];
  let inactiveCount = 0;
  let loadError: string | null = null;
  try {
    [suppliers, inactiveCount] = await Promise.all([
      fetchSuppliersWithSchedules(undefined, { inactiveOnly: true }),
      countInactiveSuppliers(),
    ]);
  } catch (e) {
    loadError = e instanceof Error ? e.message : "Nie udało się wczytać listy nieaktywnych dostawców.";
    suppliers = [];
  }

  return (
    <SuppliersHubShell
      title="Nieaktywni dostawcy"
      description={supplierHubShellDescription("inactive", "zakupy")}
      activeTab="inactive"
      context="zakupy"
      inactiveCount={inactiveCount}
    >
      {loadError ? <Alert tone="error">{loadError}</Alert> : null}
      <InactiveSuppliersAdminClient initial={suppliers} context="zakupy" />
    </SuppliersHubShell>
  );
}
