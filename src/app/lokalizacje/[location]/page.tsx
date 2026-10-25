import { userFacingErrorText } from "@/lib/ui/user-facing-error";
import { countInactiveSuppliers, fetchSuppliersWithSchedules } from "@/lib/data/queries";
import { getSessionUser } from "@/lib/auth";
import type { SupplierLocation } from "@/types/database";
import { getRowColorForDate } from "@/lib/orders/colors";
import { parseDateOnly } from "@/lib/orders/dates";
import { locationLabel } from "@/lib/display-labels";
import { LocationScheduleClient } from "@/components/targets/LocationScheduleClient";
import Link from "next/link";
import { Alert } from "@/components/ui/Alert";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageHeader } from "@/components/ui/PageHeader";
import { adminPageShellClass, brandLinkClass } from "@/lib/ui/ontime-theme";
import { logDevPageError } from "@/lib/dev/log-page-error";
import { SuppliersHubShell } from "@/components/admin/SuppliersHubShell";
import {
  supplierHubContextForRole,
  supplierHubPaths,
  supplierHubShellDescription,
} from "@/lib/supplier-hub";
import { fetchZdAutomatPolicySummaries } from "@/lib/data/zd-supplier-order-policy";
import type { Metadata } from "next";
import { pageMetadata } from "@/lib/ui/page-metadata";

const VALID: SupplierLocation[] = ["POLSKA", "ZAGRANICA", "IMPORT"];

export async function generateMetadata({
  params,
}: {
  params: Promise<{ location: string }>;
}): Promise<Metadata> {
  const { location: loc } = await params;
  const location = loc.toUpperCase() as SupplierLocation;
  if (!VALID.includes(location)) {
    return pageMetadata("Nieprawidłowa lokalizacja");
  }
  return pageMetadata(locationLabel(location));
}

export default async function LocationPage({
  params,
}: {
  params: Promise<{ location: string }>;
}) {
  const { location: loc } = await params;
  const location = loc.toUpperCase() as SupplierLocation;
  if (!VALID.includes(location)) {
    return (
      <div className={adminPageShellClass}>
        <PageHeader title="Nieprawidłowa lokalizacja" />
        <Card>
          <EmptyState
            title="Nie ma takiej lokalizacji"
            description="Terminy zamówień są dla lokalizacji Polska, Zagranica i Import."
            action={
              <Link href="/lokalizacje/polska" className={brandLinkClass}>
                Otwórz terminy: Polska
              </Link>
            }
          />
        </Card>
      </div>
    );
  }

  const label = locationLabel(location);
  const session = await getSessionUser();
  const hubContext = supplierHubContextForRole(session?.role);
  const cardsPath = supplierHubPaths(hubContext).cards;

  let rows: Awaited<ReturnType<typeof fetchSuppliersWithSchedules>> = [];
  let inactiveCount = 0;
  let automat: Awaited<ReturnType<typeof fetchZdAutomatPolicySummaries>> = {};
  let loadError: string | null = null;
  try {
    [rows, inactiveCount, automat] = await Promise.all([
      fetchSuppliersWithSchedules(location, { activeOnly: false }),
      countInactiveSuppliers(),
      // Etykieta „Automat ZD” to dodatek — błąd nie zasłania harmonogramu.
      fetchZdAutomatPolicySummaries().catch((e: unknown) => {
        logDevPageError("lokalizacje/page automat", e);
        return {};
      }),
    ]);
  } catch (error) {
    loadError = userFacingErrorText(error, "Nie udało się wczytać harmonogramów.");
    logDevPageError("lokalizacje/page", error);
    rows = [];
  }

  return (
    <SuppliersHubShell
      title={`Terminy zamówień · ${label}`}
      description={supplierHubShellDescription("schedules", hubContext)}
      activeTab="schedules"
      context={hubContext}
      scheduleLocation={location}
      inactiveCount={inactiveCount}
    >
      {loadError ? <Alert tone="error">{loadError}</Alert> : null}
      <LocationScheduleClient
        location={location}
        cardsBasePath={cardsPath}
        inHubShell
        hubContext={hubContext}
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
          automat: automat[s.id] ?? null,
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
