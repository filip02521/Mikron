import { countInactiveSuppliers, fetchSuppliersWithSchedules } from "@/lib/data/queries";
import { SuppliersAdminClient } from "@/components/admin/SuppliersAdminClient";
import { SuppliersHubShell } from "@/components/admin/SuppliersHubShell";
import type { SupplierWithSchedule } from "@/types/database";

export default async function DostawcyAdminPage() {
  let suppliers: SupplierWithSchedule[] = [];
  let inactiveCount = 0;
  try {
    [suppliers, inactiveCount] = await Promise.all([
      fetchSuppliersWithSchedules(),
      countInactiveSuppliers(),
    ]);
  } catch {
    suppliers = [];
  }

  return (
    <SuppliersHubShell
      title="Karty dostawców"
      description="Wersja administratora z usuwaniem. Daty w cyklu — w Terminach zamówień."
      activeTab="cards"
      context="admin"
      inactiveCount={inactiveCount}
    >
      <SuppliersAdminClient initial={suppliers} allowDelete />
    </SuppliersHubShell>
  );
}
