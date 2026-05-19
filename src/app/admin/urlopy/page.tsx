import { fetchVacations, fetchSuppliersWithSchedules } from "@/lib/data/queries";
import { VacationsAdminClient } from "@/components/admin/VacationsAdminClient";
import { SuppliersHubNav } from "@/components/admin/SuppliersHubNav";
import { PageHeader } from "@/components/ui/PageHeader";

export default async function UrlopyPage() {
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
        description="Te same urlopy co w widoku zakupów — wpływ na wyliczone daty zamówień."
      />
      <SuppliersHubNav activeTab="vacations" context="admin" />
      <VacationsAdminClient vacations={vacations} suppliers={suppliers} />
    </>
  );
}
