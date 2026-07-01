import { requireTeethPanel } from "@/lib/auth";
import { attachTeethDetailsToIndividualOrders } from "@/lib/data/teeth-queue";
import { fetchDeliveryQueue } from "@/lib/data/queries";
import { runOrderMaintenanceBeforePageLoad } from "@/lib/services/deferred-order-maintenance";
import { TeethReceiveClient } from "@/components/zeby/TeethReceiveClient";
import {
  TEETH_PRZYJECIE_PAGE_HINT,
  TEETH_PRZYJECIE_PAGE_TITLE,
} from "@/components/zeby/teeth-panel-copy";
import type { IndividualOrder } from "@/types/database";
import type { Metadata } from "next";
import { pageMetadata } from "@/lib/ui/page-metadata";

export const metadata: Metadata = pageMetadata(
  TEETH_PRZYJECIE_PAGE_TITLE,
  TEETH_PRZYJECIE_PAGE_HINT,
);

export const dynamic = "force-dynamic";

export default async function ZebyPrzyjeciePage() {
  await requireTeethPanel("read");
  await runOrderMaintenanceBeforePageLoad();

  let orders: IndividualOrder[] = [];
  let error: string | null = null;

  try {
    const deliveryOrders = await fetchDeliveryQueue({ lane: "teeth" });
    orders = await attachTeethDetailsToIndividualOrders(deliveryOrders);
  } catch (e) {
    error = e instanceof Error ? e.message : "Nie udało się załadować kolejki przyjęcia.";
    orders = [];
  }

  return <TeethReceiveClient orders={orders} loadError={error} />;
}
