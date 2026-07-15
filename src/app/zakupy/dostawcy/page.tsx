import { countInactiveSuppliers, fetchSuppliersWithSchedules } from "@/lib/data/queries";
import { fetchTeethSchedules, fetchTeethSupplierIds } from "@/lib/data/teeth-schedule";
import { fetchWarehouseCarriers } from "@/lib/data/warehouse-carriers";
import { SuppliersAdminClient } from "@/components/admin/SuppliersAdminClient";
import { SuppliersHubShell } from "@/components/admin/SuppliersHubShell";
import { Alert } from "@/components/ui/Alert";
import { supplierHubShellDescription } from "@/lib/supplier-hub";
import type { SupplierWithSchedule, TeethSupplierSchedule } from "@/types/database";

import type { Metadata } from "next";
import { pageMetadataFor } from "@/lib/ui/page-metadata";

export const metadata: Metadata = pageMetadataFor("procurementSuppliers");

type SearchParams = Promise<{ tor?: string }>;

export default async function ZakupyDostawcyPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const { tor } = await searchParams;
  const teethLane = tor === "zeby";

  let suppliers: SupplierWithSchedule[] = [];
  let allSuppliers: SupplierWithSchedule[] = [];
  let inactiveCount = 0;
  let warehouseCarriers: Awaited<ReturnType<typeof fetchWarehouseCarriers>> = [];
  let teethScheduleSupplierIds: string[] = [];
  let teethScheduleMap: Record<string, TeethSupplierSchedule> = {};
  let loadError: string | null = null;
  try {
    [suppliers, inactiveCount, warehouseCarriers] = await Promise.all([
      fetchSuppliersWithSchedules(),
      countInactiveSuppliers(),
      fetchWarehouseCarriers(),
    ]);
    allSuppliers = suppliers;
    if (teethLane) {
      const [teethSchedules, teethSupplierIds] = await Promise.all([
        fetchTeethSchedules(),
        fetchTeethSupplierIds(),
      ]);
      // IDs z tabeli teeth_supplier_schedules — do pickera, badge'ów, sortowania
      teethScheduleSupplierIds = teethSchedules.map((row) => row.supplier_id);
      teethScheduleMap = Object.fromEntries(
        teethSchedules.map((row) => [row.supplier_id, row])
      );
      // Filtr listy: harmonogram LUB zamówienia zębowe (fetchTeethSupplierIds)
      suppliers = suppliers.filter((s) => teethSupplierIds.has(s.id));
    }
  } catch (e) {
    loadError = e instanceof Error ? e.message : "Nie udało się wczytać listy dostawców.";
    suppliers = [];
  }

  return (
    <SuppliersHubShell
      title={teethLane ? "Karty dostawców — zęby" : "Karty dostawców"}
      description={
        teethLane
          ? "Wszystkie karty labów — cykl zębów ustawiasz w edycji karty."
          : supplierHubShellDescription("cards", "zakupy")
      }
      activeTab="cards"
      context="zakupy"
      inactiveCount={teethLane ? 0 : inactiveCount}
      teethLane={teethLane}
    >
      {loadError ? <Alert tone="error">{loadError}</Alert> : null}
      {teethLane && teethScheduleSupplierIds.length === 0 && suppliers.length > 0 && !loadError ? (
        <Alert tone="info">
          Żaden lab nie ma jeszcze cyklu zębów. Otwórz kartę dostawcy i włącz sekcję „Cykl zębów”.
        </Alert>
      ) : null}
      {teethLane && suppliers.length === 0 && !loadError ? (
        <Alert tone="info">
          Brak dostawców powiązanych z zębami. Dodaj produkt zębowy do zamówienia lub ustaw cykl
          zębów w karcie dostawcy, aby pojawił się w tym widoku.
        </Alert>
      ) : null}
      <SuppliersAdminClient
        initial={suppliers}
        allSuppliers={teethLane ? allSuppliers : undefined}
        allowDelete={false}
        warehouseCarriers={warehouseCarriers}
        teethScheduleSupplierIds={teethLane ? teethScheduleSupplierIds : undefined}
        teethScheduleMap={teethLane ? teethScheduleMap : undefined}
      />
    </SuppliersHubShell>
  );
}
