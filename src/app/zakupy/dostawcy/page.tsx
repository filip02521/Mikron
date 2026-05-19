import { fetchSuppliersWithSchedules } from "@/lib/data/queries";
import { SuppliersAdminClient } from "@/components/admin/SuppliersAdminClient";
import { SuppliersHubNav } from "@/components/admin/SuppliersHubNav";
import { PageHeader } from "@/components/ui/PageHeader";
import type { SupplierWithSchedule } from "@/types/database";

export default async function ZakupyDostawcyPage() {
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
        description="Stałe ustawienia dostawcy: kontakt, sposób zamówienia, zapas i częstotliwość. Terminów w cyklu tu nie edytujesz."
      />
      <SuppliersHubNav activeTab="cards" context="zakupy" />
      <SuppliersAdminClient initial={suppliers} allowDelete={false} />
    </>
  );
}
