import { actionGetSystemStatus } from "@/app/actions/admin";
import { actionGetSubiektStatus } from "@/app/actions/subiekt";
import { AdminHubNav } from "@/components/admin/AdminHubNav";
import { AdminSystemStatus } from "@/components/admin/AdminSystemStatus";
import { AdminToolsPanel } from "@/components/admin/AdminToolsPanel";
import { AdminDataShortcuts } from "@/components/admin/AdminDataShortcuts";
import { SubiektIntegrationPanel } from "@/components/admin/SubiektIntegrationPanel";
import { SupplierResolveMetricsCard } from "@/components/admin/SupplierResolveMetricsCard";
import { PageHeader } from "@/components/ui/PageHeader";
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
    <>
      <PageHeader
        title="Administracja"
        description="Konfiguracja długoterminowa: system, konta i handlowcy. Operacje dzienne — w menu po lewej."
      />
      <AdminHubNav activeTab="system" />
      <AdminSystemStatus isHealthy={status.isHealthy} issues={status.issues} />
      <SubiektIntegrationPanel
        initialConfigured={subiektStatus.configured}
        initialBaseUrl={subiektStatus.baseUrl}
        initialAuthMode={subiektStatus.authMode}
      />
      <SupplierResolveMetricsCard />
      <section className="mb-8 space-y-2">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
          Narzędzia serwisowe
        </h2>
        <AdminToolsPanel />
      </section>
      <AdminDataShortcuts />
    </>
  );
}
