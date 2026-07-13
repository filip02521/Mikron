import { getSessionUser } from "@/lib/auth";
import { canAccessWarehouse } from "@/lib/auth-roles";
import { fetchWarehouseCarriers } from "@/lib/data/warehouse-carriers";
import { fetchSuppliersWithSchedules } from "@/lib/data/queries";
import {
  fetchUpcomingDeliveries,
  summarizeUpcomingDeliveries,
  upcomingDeliveryPresetRange,
} from "@/lib/data/upcoming-deliveries";
import { UpcomingDeliveriesClient } from "@/components/deliveries/UpcomingDeliveriesClient";
import type { UpcomingDeliveriesPayload } from "@/app/actions/upcoming-deliveries";
import type { SupplierWithSchedule } from "@/types/database";
import { todayInWarsaw } from "@/lib/time/warsaw";
import { formatDateString } from "@/lib/orders/dates";

import type { Metadata } from "next";
import { pageMetadataFor } from "@/lib/ui/page-metadata";

export const metadata: Metadata = pageMetadataFor("dostawy");
export const dynamic = "force-dynamic";

export default async function DostawyPage() {
  const session = await getSessionUser();
  const isWarehouse = session != null && canAccessWarehouse(session.role, session.assignedWorkspaces);

  let initialPayload: UpcomingDeliveriesPayload | null = null;
  let loadError: string | null = null;
  let supplierSchedules: SupplierWithSchedule[] = [];
  const todayDateKey = formatDateString(todayInWarsaw());

  if (isWarehouse) {
    try {
      const { dateFrom, dateTo } = upcomingDeliveryPresetRange("week");
      const carriers = await fetchWarehouseCarriers();
      const [days, schedules] = await Promise.all([
        fetchUpcomingDeliveries(dateFrom, dateTo, carriers),
        fetchSuppliersWithSchedules(undefined, { activeOnly: true }),
      ]);
      const summary = summarizeUpcomingDeliveries(days);
      initialPayload = { days, summary, dateFrom, dateTo };
      supplierSchedules = schedules;
    } catch (e) {
      loadError = e instanceof Error ? e.message : "Nie udało się załadować dostaw.";
    }
  }

  return (
    <UpcomingDeliveriesClient
      initialPayload={initialPayload}
      loadError={loadError}
      isAuthorized={isWarehouse}
      supplierSchedules={supplierSchedules}
      todayDateKey={todayDateKey}
    />
  );
}
