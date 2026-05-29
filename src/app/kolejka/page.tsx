import {
  countPickupReadyForSales,
  fetchDeliveryQueue,
  fetchInformacjaQueue,
  fetchWarehouseInventory,
} from "@/lib/data/queries";
import { actionFetchTodayDeliveryJournal, actionListWarehouseAssignSuppliers } from "@/app/actions/warehouse-delivery";
import { getSessionUser } from "@/lib/auth";
import { isMagazyn } from "@/lib/auth-roles";
import { QueueClient } from "@/components/queue/QueueClient";
import { Alert } from "@/components/ui/Alert";
import type { IndividualOrder } from "@/types/database";

export default async function KolejkaPage() {
  const session = await getSessionUser();
  const role = session?.role ?? null;
  let orders: IndividualOrder[] = [];
  let informacjaOrders: IndividualOrder[] = [];
  let pickupReadyCount = 0;
  let warehouseInventory: IndividualOrder[] = [];
  let error: string | null = null;

  let deliveryJournal = {
    date: "",
    receipts: [] as Awaited<ReturnType<typeof actionFetchTodayDeliveryJournal>>["receipts"],
    summary: { receiptCount: 0, packageCount: 0, palletCount: 0 },
  };
  let journalSuppliers: Awaited<ReturnType<typeof actionListWarehouseAssignSuppliers>> = [];

  try {
    [orders, informacjaOrders, pickupReadyCount, warehouseInventory] = await Promise.all([
      fetchDeliveryQueue(),
      fetchInformacjaQueue(),
      countPickupReadyForSales(),
      fetchWarehouseInventory(),
    ]);
    if (session) {
      [deliveryJournal, journalSuppliers] = await Promise.all([
        actionFetchTodayDeliveryJournal(),
        actionListWarehouseAssignSuppliers(),
      ]);
    }
  } catch (e) {
    error = e instanceof Error ? e.message : "Nie udało się załadować kolejki.";
    orders = [];
    informacjaOrders = [];
    pickupReadyCount = 0;
    warehouseInventory = [];
  }

  return (
    <>
      {error ? (
        <Alert tone="error" className="mx-auto mb-4 max-w-6xl">
          {error}
        </Alert>
      ) : null}

      <QueueClient
        orders={orders}
        informacjaOrders={informacjaOrders}
        pickupReadyCount={pickupReadyCount}
        warehouseInventory={warehouseInventory}
        deliveryJournal={deliveryJournal}
        journalSuppliers={journalSuppliers}
        isMagazynRole={role != null && isMagazyn(role)}
      />
    </>
  );
}
