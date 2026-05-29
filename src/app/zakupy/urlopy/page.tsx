import {
  countInactiveSuppliers,
  fetchVacations,
  fetchSuppliersWithSchedules,
} from "@/lib/data/queries";
import { VacationsAdminClient } from "@/components/admin/VacationsAdminClient";
import { SuppliersHubShell } from "@/components/admin/SuppliersHubShell";

export default async function ZakupyUrlopyPage() {
  let vacations: Awaited<ReturnType<typeof fetchVacations>> = [];
  let suppliers: { id: string; name: string }[] = [];
  let inactiveCount = 0;
  try {
    const [v, s, inactive] = await Promise.all([
      fetchVacations(),
      fetchSuppliersWithSchedules(undefined, { activeOnly: false }),
      countInactiveSuppliers(),
    ]);
    vacations = v;
    suppliers = s.map((x) => ({ id: x.id, name: x.name }));
    inactiveCount = inactive;
  } catch {
    /* empty */
  }

  return (
    <SuppliersHubShell
      title="Urlopy dostawców"
      description="Okresy niedostępności — po zapisie system przelicza terminy w panelu dziennym i w Terminach zamówień."
      activeTab="vacations"
      context="zakupy"
      inactiveCount={inactiveCount}
    >
      <VacationsAdminClient vacations={vacations} suppliers={suppliers} />
    </SuppliersHubShell>
  );
}
