import { actionGetSystemStatus } from "@/app/actions/admin";
import { actionGetSubiektStatus } from "@/app/actions/subiekt";
import { AdminHubShell } from "@/components/admin/AdminHubShell";
import { AdminSystemStatus } from "@/components/admin/AdminSystemStatus";
import { AdminToolsPanel } from "@/components/admin/AdminToolsPanel";
import { AdminDataShortcuts } from "@/components/admin/AdminDataShortcuts";
import { SubiektIntegrationPanel } from "@/components/admin/SubiektIntegrationPanel";
import type { SubiektAuthMode } from "@/lib/subiekt/config";

export default async function AdminPage() {
  let status = { isHealthy: true, issues: [] as string[] };
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

  return (
    <AdminHubShell activeTab="system">
      <AdminSystemStatus isHealthy={status.isHealthy} issues={status.issues} />
      <SubiektIntegrationPanel
        initialConfigured={subiektStatus.configured}
        initialBaseUrl={subiektStatus.baseUrl}
        initialAuthMode={subiektStatus.authMode}
      />
      <AdminToolsPanel />
      <AdminDataShortcuts />
    </AdminHubShell>
  );
}
