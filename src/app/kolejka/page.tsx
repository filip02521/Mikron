import {
  countPickupReadyForSales,
  fetchDeliveryQueue,
  fetchInformacjaQueue,
} from "@/lib/data/queries";
import { QueueClient } from "@/components/queue/QueueClient";
import { PageHeader } from "@/components/ui/PageHeader";
import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
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
      <PageHeader
        badge={
          <Badge variant="info" className="mb-2">
            Magazyn i regał
          </Badge>
        }
        title="Magazyn i regał"
        description="Przyjęcie towaru dla handlowców (zamówione u dostawcy — po dotarciu wpisujesz ilość) oraz powiadomienia o dostępności."
      />

      {error ? (
        <Alert tone="error" className="mb-6">
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
