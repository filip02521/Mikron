import { getSessionUser } from "@/lib/auth";
import { canAccessWarehouse } from "@/lib/auth-roles";
import { fetchWarehouseCarriers } from "@/lib/data/warehouse-carriers";
import {
  fetchUpcomingDeliveries,
  summarizeUpcomingDeliveries,
  upcomingDeliveryPresetRange,
} from "@/lib/data/upcoming-deliveries";
import { UpcomingDeliveriesClient } from "@/components/deliveries/UpcomingDeliveriesClient";
import type { UpcomingDeliveriesPayload } from "@/app/actions/upcoming-deliveries";

import type { Metadata } from "next";
import { pageMetadataFor } from "@/lib/ui/page-metadata";

export const metadata: Metadata = pageMetadataFor("dostawy");

export default async function DostawyPage() {
  const session = await getSessionUser();
  const isWarehouse = session != null && canAccessWarehouse(session.role, session.assignedWorkspaces);

  let initialPayload: UpcomingDeliveriesPayload | null = null;
  let loadError: string | null = null;

  if (isWarehouse) {
    try {
      const { dateFrom, dateTo } = upcomingDeliveryPresetRange("week");
      const carriers = await fetchWarehouseCarriers();
      const days = await fetchUpcomingDeliveries(dateFrom, dateTo, carriers);
      const summary = summarizeUpcomingDeliveries(days);
      initialPayload = { days, summary, dateFrom, dateTo };
    } catch (e) {
      loadError = e instanceof Error ? e.message : "Nie udało się załadować dostaw.";
    }
  }

  return (
    <UpcomingDeliveriesClient
      initialPayload={initialPayload}
      loadError={loadError}
      isAuthorized={isWarehouse}
    />
  );
}
