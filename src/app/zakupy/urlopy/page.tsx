import { fetchVacations, fetchSuppliersWithSchedules } from "@/lib/data/queries";
import { VacationsAdminClient } from "@/components/admin/VacationsAdminClient";
import { SuppliersHubNav } from "@/components/admin/SuppliersHubNav";
import { PageHeader } from "@/components/ui/PageHeader";

export default async function ZakupyUrlopyPage() {
  let vacations: Awaited<ReturnType<typeof fetchVacations>> = [];
  let suppliers: { id: string; name: string }[] = [];
  try {
    vacations = await fetchVacations();
    const s = await fetchSuppliersWithSchedules();
    suppliers = s.map((x) => ({ id: x.id, name: x.name }));
  } catch {
    /* empty */
  }

  return (
    <>
      <PageHeader
        title="Urlopy dostawców"
        description="Okresy niedostępności — po zapisie system przelicza terminy w panelu dziennym i w Terminach zamówień."
      />
      <SuppliersHubNav activeTab="vacations" context="zakupy" />
      <VacationsAdminClient vacations={vacations} suppliers={suppliers} />
    </>
  );
}
