import { countInactiveSuppliers, fetchSuppliersWithSchedules } from "@/lib/data/queries";
import { SuppliersAdminClient } from "@/components/admin/SuppliersAdminClient";
import { SuppliersHubShell } from "@/components/admin/SuppliersHubShell";
import { Alert } from "@/components/ui/Alert";
import { supplierHubShellDescription } from "@/lib/supplier-hub";
import type { SupplierWithSchedule } from "@/types/database";

export default async function ZakupyDostawcyPage() {
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
      description={supplierHubShellDescription("cards", "zakupy")}
      activeTab="cards"
      context="zakupy"
      inactiveCount={inactiveCount}
    >
      {loadError ? <Alert tone="error">{loadError}</Alert> : null}
      <SuppliersAdminClient initial={suppliers} allowDelete={false} />
    </SuppliersHubShell>
  );
}
