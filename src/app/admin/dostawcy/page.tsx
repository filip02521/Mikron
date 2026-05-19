import { fetchSuppliersWithSchedules } from "@/lib/data/queries";
import { SuppliersAdminClient } from "@/components/admin/SuppliersAdminClient";
import { SuppliersHubNav } from "@/components/admin/SuppliersHubNav";
import { PageHeader } from "@/components/ui/PageHeader";
import type { SupplierWithSchedule } from "@/types/database";

export default async function DostawcyAdminPage() {
  let suppliers: SupplierWithSchedule[] = [];
  try {
    suppliers = await fetchSuppliersWithSchedules();
  } catch {
    suppliers = [];
  }

  return (
    <>
      <PageHeader
        title="Karty dostawców"
        description="Wersja administratora z usuwaniem. Codzienna edycja bez usuwania — w menu Dostawcy. Daty — w Terminach zamówień."
      />
      <SuppliersHubNav activeTab="cards" context="admin" />
      <SuppliersAdminClient initial={suppliers} allowDelete />
    </>
  );
}
