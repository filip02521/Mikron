import { countInactiveSuppliers, fetchSuppliersWithSchedules } from "@/lib/data/queries";
import { fetchTeethSchedules } from "@/lib/data/teeth-schedule";
import { fetchWarehouseCarriers } from "@/lib/data/warehouse-carriers";
import { SuppliersAdminClient } from "@/components/admin/SuppliersAdminClient";
import { SuppliersHubShell } from "@/components/admin/SuppliersHubShell";
import { Alert } from "@/components/ui/Alert";
import { supplierHubShellDescription } from "@/lib/supplier-hub";
import type { SupplierWithSchedule } from "@/types/database";

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
  let inactiveCount = 0;
  let warehouseCarriers: Awaited<ReturnType<typeof fetchWarehouseCarriers>> = [];
  let teethScheduleSupplierIds: string[] = [];
  let loadError: string | null = null;
  try {
    [suppliers, inactiveCount, warehouseCarriers] = await Promise.all([
      fetchSuppliersWithSchedules(),
      countInactiveSuppliers(),
      fetchWarehouseCarriers(),
    ]);
    if (teethLane) {
      const teethSchedules = await fetchTeethSchedules();
      teethScheduleSupplierIds = teethSchedules.map((row) => row.supplier_id);
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
      <SuppliersAdminClient
        initial={suppliers}
        allowDelete={false}
        warehouseCarriers={warehouseCarriers}
        teethScheduleSupplierIds={teethLane ? teethScheduleSupplierIds : undefined}
      />
    </SuppliersHubShell>
  );
}
