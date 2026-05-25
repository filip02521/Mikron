import {
  countPickupReadyForSales,
  fetchDeliveryQueue,
  fetchInformacjaQueue,
} from "@/lib/data/queries";
import { QueueClient } from "@/components/queue/QueueClient";
import { Alert } from "@/components/ui/Alert";
import type { IndividualOrder } from "@/types/database";

export default async function KolejkaPage() {
  let orders: IndividualOrder[] = [];
  let informacjaOrders: IndividualOrder[] = [];
  let pickupReadyCount = 0;
  let error: string | null = null;

  try {
    [orders, informacjaOrders, pickupReadyCount] = await Promise.all([
      fetchDeliveryQueue(),
      fetchInformacjaQueue(),
      countPickupReadyForSales(),
    ]);
  } catch (e) {
    error = e instanceof Error ? e.message : "Nie udało się załadować kolejki.";
    orders = [];
    informacjaOrders = [];
    pickupReadyCount = 0;
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
      />
    </>
  );
}
