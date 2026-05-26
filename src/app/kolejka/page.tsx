import {
  countPickupReadyForSales,
  fetchDeliveryQueue,
  fetchInformacjaQueue,
  fetchWarehouseInventory,
} from "@/lib/data/queries";
import { QueueClient } from "@/components/queue/QueueClient";
import { Alert } from "@/components/ui/Alert";
import type { IndividualOrder } from "@/types/database";

export default async function KolejkaPage() {
  let orders: IndividualOrder[] = [];
  let informacjaOrders: IndividualOrder[] = [];
  let pickupReadyCount = 0;
  let warehouseInventory: IndividualOrder[] = [];
  let error: string | null = null;

  try {
    [orders, informacjaOrders, pickupReadyCount, warehouseInventory] = await Promise.all([
      fetchDeliveryQueue(),
      fetchInformacjaQueue(),
      countPickupReadyForSales(),
      fetchWarehouseInventory(),
    ]);
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
      />
    </>
  );
}
