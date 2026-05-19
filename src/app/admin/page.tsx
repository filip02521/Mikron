import { actionGetSystemStatus } from "@/app/actions/admin";
import { AdminHubNav } from "@/components/admin/AdminHubNav";
import { AdminSystemStatus } from "@/components/admin/AdminSystemStatus";
import { AdminToolsPanel } from "@/components/admin/AdminToolsPanel";
import { AdminDataShortcuts } from "@/components/admin/AdminDataShortcuts";
import { PageHeader } from "@/components/ui/PageHeader";

export default async function AdminPage() {
  let status = { isHealthy: true, issues: [] as string[] };
  try {
    status = await actionGetSystemStatus();
  } catch {
    status = { isHealthy: false, issues: ["Brak połączenia z bazą"] };
  }

  return (
    <>
      <PageHeader
        title="Administracja"
        description="Konfiguracja długoterminowa: system, konta i handlowcy. Operacje dzienne — w menu po lewej."
      />
      <AdminHubNav activeTab="system" />
      <AdminSystemStatus isHealthy={status.isHealthy} issues={status.issues} />
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
