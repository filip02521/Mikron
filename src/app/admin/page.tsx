import { actionGetSystemStatus } from "@/app/actions/admin";
import { actionGetSubiektStatus } from "@/app/actions/subiekt";
import { AdminCronStatusPanel } from "@/components/admin/AdminCronStatusPanel";
import { AdminHubShell } from "@/components/admin/AdminHubShell";
import { AdminSystemStatus } from "@/components/admin/AdminSystemStatus";
import { AdminToolsPanel } from "@/components/admin/AdminToolsPanel";
import { AdminDataShortcuts } from "@/components/admin/AdminDataShortcuts";
import { DeliveryStatsDiagnosticsPanel } from "@/components/admin/DeliveryStatsDiagnosticsPanel";
import { SubiektIntegrationPanel } from "@/components/admin/SubiektIntegrationPanel";
import { fetchDeliveryStatsDiagnostics } from "@/lib/data/delivery-stats-diagnostics";
import { buildCronMonitorSnapshot } from "@/lib/services/cron-monitor";
import type { CronJobId } from "@/lib/services/cron-run-log";
import type { SubiektAuthMode } from "@/lib/subiekt/config";

import type { Metadata } from "next";
import { pageMetadataFor } from "@/lib/ui/page-metadata";

export const metadata: Metadata = pageMetadataFor("admin");

export default async function AdminPage() {
  let status: { isHealthy: boolean; issues: string[] };
  try {
    status = await actionGetSystemStatus();
  } catch {
    status = { isHealthy: false, issues: ["Brak połączenia z bazą"] };
  }

  let subiektStatus = {
    configured: false,
    baseUrl: null as string | null,
    authMode: null as SubiektAuthMode | null,
  };
  try {
    subiektStatus = await actionGetSubiektStatus();
  } catch {
    /* brak sesji admin — nie powinno wystąpić na tej stronie */
  }

  let deliveryStatsDiagnostics = null;
  try {
    deliveryStatsDiagnostics = await fetchDeliveryStatsDiagnostics();
  } catch {
    /* diagnostyka opcjonalna — panel pokaże komunikat */
  }

  let cronMonitor = buildCronMonitorSnapshot({
    morning_routine: null,
    process_deliveries: null,
    morning_sync: null,
    catalog_zd_sync: null,
    zd_eta_sync: null,
  } satisfies Record<CronJobId, null>);
  try {
    const { fetchCronMonitorSnapshot } = await import("@/lib/services/cron-monitor");
    cronMonitor = await fetchCronMonitorSnapshot();
  } catch {
    /* fallback — pusty snapshot, panel i tak się wyświetli */
  }

  return (
    <AdminHubShell activeTab="system">
      <AdminSystemStatus isHealthy={status.isHealthy} issues={status.issues} />
      <AdminCronStatusPanel initialSnapshot={cronMonitor} />
      <SubiektIntegrationPanel
        initialConfigured={subiektStatus.configured}
        initialBaseUrl={subiektStatus.baseUrl}
        initialAuthMode={subiektStatus.authMode}
      />
      <DeliveryStatsDiagnosticsPanel initialData={deliveryStatsDiagnostics} />
      <AdminToolsPanel />
      <AdminDataShortcuts />
    </AdminHubShell>
  );
}
