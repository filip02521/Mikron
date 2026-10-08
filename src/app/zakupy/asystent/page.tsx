import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireOperations } from "@/lib/auth";
import { assistantReports } from "@/lib/assistant/reports";
import { createAdminClient, hasDatabaseConfig } from "@/lib/db/admin";
import { getEmailSignature, getGmailConnection, getPaymentForwardEmail } from "@/lib/google/gmail-connections";
import { loadOcChecks } from "@/lib/oc-check/data";
import type { OcCheck } from "@/lib/oc-check/types";
import { groupOcChecks, parseOcView, type OcView } from "@/lib/oc-check/view";
import { loadSupplierMailView } from "@/lib/supplier-mail/data";
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
import { SupplierMailWorkspace } from "@/components/zakupy/supplier-mail/SupplierMailWorkspace";

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

type Section = "poczta" | "oc" | "raporty";

function parseSection(raw: string | undefined): Section {
  return raw === "oc" || raw === "raporty" ? raw : "poczta";
}

export default async function AsystentPage({
  searchParams,
}: {
  searchParams: Promise<{ widok?: string; sekcja?: string }>;
}) {
  const user = await requireOperations("read");
  // Raporty dotyczą skrzynki działu zakupów — jak Kreator ZD, tylko admin i zakupy.
  if (user.role !== "admin" && user.role !== "zakupy") notFound();

  const params = await searchParams;
  const section = parseSection(params.sekcja);
  const view = parseOcView(params.widok);
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
    { id: "do-ruchu", label: "Do ruchu", hint: "Rozbieżności i sprawy do decyzji", href: "/zakupy/asystent?sekcja=oc", badgeCount: groups["do-ruchu"].length },
    { id: "zgodne", label: "Zgodne", hint: "OC zgodne z ZD", href: "/zakupy/asystent?sekcja=oc&widok=zgodne", badgeCount: groups.zgodne.length },
    { id: "wyjasnione", label: "Wyjaśnione", hint: "Decyzje z ostatnich 30 dni", href: "/zakupy/asystent?sekcja=oc&widok=wyjasnione" },
  ];
  const list = groups[view];

  // Poczta dostawców: lista z bazy od razu; nowe maile z Gmaila dociąga komponent po wejściu.
  const [mail, conn, signature, paymentForwardEmail] = await Promise.all([
    loadSupplierMailView().catch(() => null),
    getGmailConnection(user.id).catch(() => null),
    getEmailSignature(user.id).catch(() => ""),
    getPaymentForwardEmail(user.id).catch(() => ""),
  ]);
  const sections: SectionTab<Section>[] = [
    {
      id: "poczta",
      label: "Poczta dostawców",
      hint: "Sprawy z dostawcami: do zrobienia, w trakcie, czekam, do zapłaty",
      href: "/zakupy/asystent",
      badgeCount: mail ? mail.items.filter((i) => i.column === "todo" && (!i.assigneeId || i.assigneeId === user.id)).length : 0,
    },
    { id: "oc", label: "Kontrola OC", hint: "Potwierdzenia porównane z ZD", href: "/zakupy/asystent?sekcja=oc", badgeCount: groups["do-ruchu"].length },
    { id: "raporty", label: "Raporty", hint: "Raporty rutyn w chmurze", href: "/zakupy/asystent?sekcja=raporty" },
  ];

  return (
    <div className={panelPageShellClass}>
      <PageHeader
        title="Asystent"
        description="Sprawy z dostawcami w jednym miejscu: co jest do zrobienia, co w trakcie, na co czekasz i co do zapłaty - oraz kontrola OC."
      />

      <SectionTabNav activeTab={section} tabs={sections} ariaLabel="Sekcje Asystenta" sectionLabel="Asystent" />

      {section === "poczta" ? (
        mail ? (
          <SupplierMailWorkspace
            initialView={mail}
            initialMe={conn?.email ?? null}
            initialMeId={user.id}
            initialCanReply={Boolean(conn)}
            initialSignature={signature}
            initialPaymentForwardEmail={paymentForwardEmail}
          />
        ) : (
          <Alert tone="error">
            Nie udało się wczytać poczty dostawców. Sprawdź, czy migracje 178_supplier_mail i 183_mail_board zostały uruchomione.
          </Alert>
        )
      ) : null}

      {section === "oc" ? (
        <>
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
        </>
      ) : null}

      {section === "raporty" ? (
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
      ) : null}
    </div>
  );
}
