import {
  countPickupReadyForSales,
  fetchDeliveryQueue,
  fetchInformacjaQueue,
  fetchSuppliersWithSchedules,
  fetchWarehouseInventory,
} from "@/lib/data/queries";
import { runOrderMaintenanceBeforePageLoad } from "@/lib/services/deferred-order-maintenance";
import { actionFetchTodayDeliveryJournal, actionListWarehouseAssignSuppliers } from "@/app/actions/warehouse-delivery";
import { getSessionUser } from "@/lib/auth";
import { canManageSuppliers, isMagazyn } from "@/lib/auth-roles";
import { fetchWarehouseCarriers } from "@/lib/data/warehouse-carriers";
import { QueueClient } from "@/components/queue/QueueClient";
import type { IndividualOrder, SupplierWithSchedule } from "@/types/database";

import type { Metadata } from "next";
import { pageMetadataFor } from "@/lib/ui/page-metadata";

export const metadata: Metadata = pageMetadataFor("kolejka");
export const dynamic = "force-dynamic";

export default async function KolejkaPage() {
  await runOrderMaintenanceBeforePageLoad();

  const session = await getSessionUser();
  const role = session?.role ?? null;
  let orders: IndividualOrder[] = [];
  let informacjaOrders: IndividualOrder[] = [];
  let pickupReadyCount = 0;
  let warehouseInventory: IndividualOrder[] = [];
  let supplierSchedules: SupplierWithSchedule[] = [];
  let error: string | null = null;

  let deliveryJournal = {
    date: "",
    receipts: [] as Awaited<ReturnType<typeof actionFetchTodayDeliveryJournal>>["receipts"],
    summary: { receiptCount: 0, packageCount: 0, palletCount: 0 },
    pendingBySupplier: {} as Record<string, number>,
  };
  let journalSuppliers: Awaited<ReturnType<typeof actionListWarehouseAssignSuppliers>> = [];
  let warehouseCarriers: Awaited<ReturnType<typeof fetchWarehouseCarriers>> = [];

  try {
    [orders, informacjaOrders, pickupReadyCount, warehouseInventory, supplierSchedules] = await Promise.all([
      fetchDeliveryQueue({ lane: "regular" }),
      fetchInformacjaQueue(),
      countPickupReadyForSales(),
      fetchWarehouseInventory(),
      fetchSuppliersWithSchedules(undefined, { activeOnly: true }),
    ]);
    if (session) {
      [deliveryJournal, journalSuppliers, warehouseCarriers] = await Promise.all([
        actionFetchTodayDeliveryJournal(),
        actionListWarehouseAssignSuppliers(),
        fetchWarehouseCarriers(),
      ]);
    }
  } catch (e) {
    error = e instanceof Error ? e.message : "Nie udało się załadować kolejki.";
    orders = [];
    informacjaOrders = [];
    pickupReadyCount = 0;
    warehouseInventory = [];
    supplierSchedules = [];
  }

  return (
    <QueueClient
      orders={orders}
      informacjaOrders={informacjaOrders}
      pickupReadyCount={pickupReadyCount}
      warehouseInventory={warehouseInventory}
      supplierSchedules={supplierSchedules}
      deliveryJournal={deliveryJournal}
      journalSuppliers={journalSuppliers}
      warehouseCarriers={warehouseCarriers}
      canManageCarriers={role != null && canManageSuppliers(role, session?.assignedWorkspaces)}
      isMagazynRole={role != null && isMagazyn(role, session?.assignedWorkspaces)}
      loadError={error}
    />
  );
}
