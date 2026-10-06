import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireOperations } from "@/lib/auth";
import { assistantReports } from "@/lib/assistant/reports";
import { pageMetadataFor } from "@/lib/ui/page-metadata";
import { buttonPrimaryClass, panelPageShellClass } from "@/lib/ui/ontime-theme";
import { cn } from "@/lib/cn";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";

export const metadata: Metadata = pageMetadataFor("assistant");
export const dynamic = "force-dynamic";

export default async function AsystentPage() {
  const user = await requireOperations("read");
  // Raporty dotyczą skrzynki działu zakupów — jak Kreator ZD, tylko admin i zakupy.
  if (user.role !== "admin" && user.role !== "zakupy") notFound();

  const reports = assistantReports();

  return (
    <div className={panelPageShellClass}>
      <PageHeader
        title="Asystent"
        description="Automatyczne kontrole maili działu zakupów. Raporty otwierają się w nowej karcie na koncie Claude właściciela rutyny."
      />

      <div className="grid gap-6 md:grid-cols-2">
        {reports.map((report) => (
          <Card key={report.key} className="flex flex-col gap-4">
            <div className="space-y-2">
              <h2 className="text-base font-semibold tracking-tight text-slate-900">{report.title}</h2>
              <p className="text-sm leading-relaxed text-slate-600">{report.description}</p>
            </div>
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
              <dt className="text-slate-500">Harmonogram</dt>
              <dd className="text-slate-900 tabular-nums">{report.schedule}</dd>
            </dl>
            <div className="mt-auto">
              {report.url ? (
                <a
                  href={report.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={cn(
                    buttonPrimaryClass,
                    "inline-flex min-h-10 items-center rounded-md px-4 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/45 focus-visible:ring-offset-1"
                  )}
                >
                  Otwórz raport
                </a>
              ) : (
                <p className="text-sm text-slate-500">
                  Link nie jest skonfigurowany. Ustaw <code className="font-mono text-xs">{report.envVar}</code> w
                  .env serwera.
                </p>
              )}
            </div>
          </Card>
        ))}
      </div>

      <p className="text-sm leading-relaxed text-slate-500">
        Kontrole działają tylko do odczytu: niczego nie wysyłają ani nie zmieniają w skrzynce. Rozbieżności z OC
        trzeba wyjaśnić z dostawcą ręcznie.
      </p>
    </div>
  );
}
