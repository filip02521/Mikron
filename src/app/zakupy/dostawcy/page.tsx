import { fetchSuppliersWithSchedules } from "@/lib/data/queries";
import { SuppliersAdminClient } from "@/components/admin/SuppliersAdminClient";
import { SuppliersHubShell } from "@/components/admin/SuppliersHubShell";
import type { SupplierWithSchedule } from "@/types/database";

export default async function ZakupyDostawcyPage() {
  let suppliers: SupplierWithSchedule[] = [];
  try {
    suppliers = await fetchSuppliersWithSchedules();
  } catch {
    suppliers = [];
  }

  return (
    <SuppliersHubShell
      title="Karty dostawców"
      description="Stałe ustawienia dostawcy: kontakt, sposób zamówienia, zapas i częstotliwość. Terminów w cyklu edytujesz w zakładce Terminy zamówień."
      activeTab="cards"
      context="zakupy"
    >
      <SuppliersAdminClient initial={suppliers} allowDelete={false} />
    </SuppliersHubShell>
  );
}
