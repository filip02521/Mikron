import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireOperations } from "@/lib/auth";
import { assistantReports } from "@/lib/assistant/reports";
import { createAdminClient, hasDatabaseConfig } from "@/lib/db/admin";
import { loadOcChecks } from "@/lib/oc-check/data";
import type { OcCheck } from "@/lib/oc-check/types";
import { groupOcChecks, parseOcView, type OcView } from "@/lib/oc-check/view";
import { pageMetadataFor } from "@/lib/ui/page-metadata";
import { buttonPrimaryClass, panelPageShellClass } from "@/lib/ui/ontime-theme";
import { cn } from "@/lib/cn";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { Alert } from "@/components/ui/Alert";
import { EmptyState } from "@/components/ui/EmptyState";
import { SectionTabNav, type SectionTab } from "@/components/ui/SectionTabNav";
import { OcCheckCard } from "@/components/zakupy/oc-check/OcCheckCard";
import { OcCheckImportForm } from "@/components/zakupy/oc-check/OcCheckImportForm";

export const metadata: Metadata = pageMetadataFor("assistant");
export const dynamic = "force-dynamic";

const EMPTY_COPY: Record<OcView, { title: string; description: string }> = {
  "do-ruchu": {
    title: "Nic nie czeka na ruch",
    description: "Rozbieżności i potwierdzenia do decyzji pojawią się tutaj po kolejnej kontroli.",
  },
  zgodne: { title: "Brak zgodnych potwierdzeń", description: "Zgodne OC trafiają tutaj jako informacja." },
  wyjasnione: { title: "Brak wyjaśnionych spraw", description: "Pokazujemy sprawy wyjaśnione w ostatnich 30 dniach." },
};

export default async function AsystentPage({
  searchParams,
}: {
  searchParams: Promise<{ widok?: string }>;
}) {
  const user = await requireOperations("read");
  // Raporty dotyczą skrzynki działu zakupów — jak Kreator ZD, tylko admin i zakupy.
  if (user.role !== "admin" && user.role !== "zakupy") notFound();

  const view = parseOcView((await searchParams).widok);
  const reports = assistantReports();

  let checks: OcCheck[] = [];
  let loadError: string | null = null;
  if (hasDatabaseConfig()) {
    try {
      checks = await loadOcChecks(createAdminClient());
    } catch {
      loadError = "Nie udało się wczytać spraw kontroli OC. Sprawdź, czy migracja 175_oc_checks została uruchomiona.";
    }
  }
  const groups = groupOcChecks(checks);
  const tabs: SectionTab<OcView>[] = [
    { id: "do-ruchu", label: "Do ruchu", hint: "Rozbieżności i sprawy do decyzji", href: "/zakupy/asystent", badgeCount: groups["do-ruchu"].length },
    { id: "zgodne", label: "Zgodne", hint: "OC zgodne z ZD", href: "/zakupy/asystent?widok=zgodne", badgeCount: groups.zgodne.length },
    { id: "wyjasnione", label: "Wyjaśnione", hint: "Decyzje z ostatnich 30 dni", href: "/zakupy/asystent?widok=wyjasnione" },
  ];
  const list = groups[view];

  return (
    <div className={panelPageShellClass}>
      <PageHeader
        title="Asystent"
        description="Potwierdzenia zamówień od dostawców porównane z ZD. Najpierw sprawy, które wymagają ruchu."
      />

      {loadError ? <Alert tone="error">{loadError}</Alert> : null}

      <section aria-labelledby="oc-heading" className="space-y-4">
        <h2 id="oc-heading" className="sr-only">
          Kontrola potwierdzeń zamówień
        </h2>
        <SectionTabNav activeTab={view} tabs={tabs} ariaLabel="Widok spraw kontroli OC" sectionLabel="Kontrola OC" />
        {list.length > 0 ? (
          <ul className="space-y-3">
            {list.map((check) => (
              <OcCheckCard key={check.id} check={check} />
            ))}
          </ul>
        ) : (
          <Card padding={false}>
            <EmptyState title={EMPTY_COPY[view].title} description={EMPTY_COPY[view].description} />
          </Card>
        )}
      </section>

      <Card>
        <details>
          <summary className="cursor-pointer text-sm font-medium text-slate-900 transition-colors duration-200 hover:text-slate-700">
            Import wyników kontroli
          </summary>
          <p className="mt-2 mb-4 text-sm leading-relaxed text-slate-600">
            Do czasu odczytu Gmaila w OnTime wyniki z rutyny wklejasz tutaj. Ponowny import tej samej sprawy aktualizuje
            porównanie, ale nie zmienia decyzji „Wyjaśnione”.
          </p>
          <OcCheckImportForm />
        </details>
      </Card>

      <section aria-labelledby="reports-heading" className="space-y-3">
        <h2 id="reports-heading" className="text-sm font-semibold text-slate-900">
          Raporty rutyn
        </h2>
        <div className="grid gap-4 md:grid-cols-2">
          {reports.map((report) => (
            <Card key={report.key} className="flex flex-col gap-3">
              <div className="space-y-1">
                <h3 className="text-[0.9375rem] font-semibold tracking-tight text-slate-900">{report.title}</h3>
                <p className="text-sm leading-relaxed text-slate-600">{report.description}</p>
                <p className="text-xs text-slate-500 tabular-nums">{report.schedule}</p>
              </div>
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
      </section>
    </div>
  );
}
