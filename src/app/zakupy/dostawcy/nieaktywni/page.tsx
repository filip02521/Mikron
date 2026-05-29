import { countInactiveSuppliers, fetchSuppliersWithSchedules } from "@/lib/data/queries";
import { InactiveSuppliersAdminClient } from "@/components/admin/InactiveSuppliersAdminClient";
import { SuppliersHubShell } from "@/components/admin/SuppliersHubShell";

export default async function NieaktywniZakupyPage() {
  let suppliers: Awaited<ReturnType<typeof fetchSuppliersWithSchedules>> = [];
  let inactiveCount = 0;
  try {
    [suppliers, inactiveCount] = await Promise.all([
      fetchSuppliersWithSchedules(undefined, { inactiveOnly: true }),
      countInactiveSuppliers(),
    ]);
  } catch {
    suppliers = [];
  }

  return (
    <SuppliersHubShell
      title="Nieaktywni dostawcy"
      description="Ukryci w panelu dziennym. Przywróć aktywność lub edytuj terminy w harmonogramie."
      activeTab="inactive"
      context="zakupy"
      inactiveCount={inactiveCount}
    >
      <InactiveSuppliersAdminClient initial={suppliers} context="zakupy" />
    </SuppliersHubShell>
  );
}
