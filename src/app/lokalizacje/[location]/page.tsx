import { countInactiveSuppliers, fetchSuppliersWithSchedules } from "@/lib/data/queries";
import { getSessionUser } from "@/lib/auth";
import type { SupplierLocation } from "@/types/database";
import { getRowColorForDate } from "@/lib/orders/colors";
import { parseDateOnly } from "@/lib/orders/dates";
import { locationLabel } from "@/lib/display-labels";
import { LocationScheduleClient } from "@/components/targets/LocationScheduleClient";
import { SuppliersHubShell } from "@/components/admin/SuppliersHubShell";
import { ScheduleLocationNav } from "@/components/admin/ScheduleLocationNav";
import { supplierHubPaths } from "@/lib/supplier-hub";

const VALID: SupplierLocation[] = ["POLSKA", "ZAGRANICA", "IMPORT"];

export default async function LocationPage({
  params,
}: {
  params: Promise<{ location: string }>;
}) {
  const { location: loc } = await params;
  const location = loc.toUpperCase() as SupplierLocation;
  if (!VALID.includes(location)) {
    return <p className="text-red-600">Nieprawidłowa lokalizacja</p>;
  }

  const label = locationLabel(location);
  const session = await getSessionUser();
  const hubContext = session?.role === "admin" ? "admin" : "zakupy";
  const cardsPath = supplierHubPaths(hubContext).cards;

  let rows: Awaited<ReturnType<typeof fetchSuppliersWithSchedules>> = [];
  let inactiveCount = 0;
  try {
    [rows, inactiveCount] = await Promise.all([
      fetchSuppliersWithSchedules(location, { activeOnly: false }),
      countInactiveSuppliers(),
    ]);
  } catch {
    rows = [];
  }

  return (
    <SuppliersHubShell
      title={`Terminy zamówień · ${label}`}
      description="Daty w cyklu zamówień (ostatnie, następne, przesunięcie). Kontakt i zapas — w Kartach dostawców."
      activeTab="schedules"
      context={hubContext}
      scheduleLocation={location}
      inactiveCount={inactiveCount}
      locationNav={<ScheduleLocationNav value={location} context={hubContext} />}
    >
      <LocationScheduleClient
        location={location}
        cardsBasePath={cardsPath}
        inHubShell
        initialRows={rows.map((s) => ({
          id: s.id,
          name: s.name,
          interval_hint:
            s.interval_raw?.trim() ||
            (s.interval_weeks ? `${s.interval_weeks} tyg.` : null),
          is_active: s.is_active !== false,
          order_date: s.schedule?.order_date ?? null,
          shift_date: s.schedule?.shift_date ?? null,
          next_date: s.schedule?.computed_next_date ?? null,
          vacation_note: s.schedule?.vacation_note ?? null,
          rowColor:
            s.is_active === false
              ? "#f1f5f9"
              : getRowColorForDate(
                  parseDateOnly(s.schedule?.computed_next_date ?? null)
                ) ?? "#fff",
        }))}
      />
    </SuppliersHubShell>
  );
}
