import {
  countInactiveSuppliers,
  fetchVacations,
  fetchSuppliersWithSchedules,
} from "@/lib/data/queries";
import { VacationsAdminClient } from "@/components/admin/VacationsAdminClient";
import { SuppliersHubShell } from "@/components/admin/SuppliersHubShell";
import { Alert } from "@/components/ui/Alert";
import { supplierHubShellDescription } from "@/lib/supplier-hub";

import type { Metadata } from "next";
import { pageMetadataFor } from "@/lib/ui/page-metadata";

export const metadata: Metadata = pageMetadataFor("adminVacations");

export default async function UrlopyPage() {
  let vacations: Awaited<ReturnType<typeof fetchVacations>> = [];
  let suppliers: { id: string; name: string }[] = [];
  let inactiveCount = 0;
  let loadError: string | null = null;
  try {
    const [v, s, inactive] = await Promise.all([
      fetchVacations(),
      fetchSuppliersWithSchedules(undefined, { activeOnly: false }),
      countInactiveSuppliers(),
    ]);
    vacations = v;
    suppliers = s.map((x) => ({ id: x.id, name: x.name }));
    inactiveCount = inactive;
  } catch (e) {
    loadError = e instanceof Error ? e.message : "Nie udało się wczytać urlopów dostawców.";
  }

  return (
    <SuppliersHubShell
      title="Urlopy dostawców"
      description={supplierHubShellDescription("vacations", "admin")}
      activeTab="vacations"
      context="admin"
      inactiveCount={inactiveCount}
    >
      {loadError ? <Alert tone="error">{loadError}</Alert> : null}
      <VacationsAdminClient vacations={vacations} suppliers={suppliers} />
    </SuppliersHubShell>
  );
}
