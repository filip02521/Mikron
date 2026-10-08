import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireOperations } from "@/lib/auth";
import { assistantReports } from "@/lib/assistant/reports";
import { createAdminClient, hasDatabaseConfig } from "@/lib/db/admin";
import { getEmailSignature, getGmailConnection, getPaymentForwardEmail } from "@/lib/google/gmail-connections";
import { loadOcChecks } from "@/lib/oc-check/data";
import type { OcCheck } from "@/lib/oc-check/types";
import { groupOcChecks, OC_VIEWS, parseOcView, type OcView } from "@/lib/oc-check/view";
import { isCustomsAiConfigured } from "@/lib/customs/customs-ai";
import { loadSupplierMailView } from "@/lib/supplier-mail/data";
import { pageMetadataFor } from "@/lib/ui/page-metadata";
import { buttonPrimaryClass } from "@/lib/ui/ontime-theme";
import { cn } from "@/lib/cn";
import { IconChevronRight, IconClipboardList, IconClock } from "@/components/icons/StrokeIcons";
import { Alert } from "@/components/ui/Alert";
import { HelpHintBubble } from "@/components/ui/HelpHintBubble";
import {
  DetailEmpty,
  listColumnClass,
  RailCount,
  railClass,
  railGroupLabelClass,
  railItemClass,
  workspaceGridClass,
} from "@/components/zakupy/asystent/workspace";
import { OcCheckDetail } from "@/components/zakupy/oc-check/OcCheckDetail";
import { ocCheckHref, OcCheckList } from "@/components/zakupy/oc-check/OcCheckList";
import { OcCheckImportForm } from "@/components/zakupy/oc-check/OcCheckImportForm";
import { SupplierMailWorkspace } from "@/components/zakupy/supplier-mail/SupplierMailWorkspace";

export const metadata: Metadata = pageMetadataFor("assistant");
export const dynamic = "force-dynamic";

const OC_VIEW_COPY: Record<OcView, { label: string; hint: string; emptyTitle: string; emptyHint: string }> = {
  "do-ruchu": {
    label: "Do ruchu",
    hint: "Rozbieżności i sprawy do decyzji",
    emptyTitle: "Nic nie czeka na ruch",
    emptyHint: "Rozbieżności i potwierdzenia do decyzji pojawią się tutaj po kolejnej kontroli.",
  },
  zgodne: {
    label: "Zgodne",
    hint: "OC zgodne z ZD",
    emptyTitle: "Brak zgodnych potwierdzeń",
    emptyHint: "Zgodne OC trafiają tutaj jako informacja.",
  },
  wyjasnione: {
    label: "Wyjaśnione",
    hint: "Decyzje z ostatnich 30 dni",
    emptyTitle: "Brak wyjaśnionych spraw",
    emptyHint: "Pokazujemy sprawy wyjaśnione w ostatnich 30 dniach.",
  },
};

type Section = "poczta" | "oc" | "raporty";

const SECTION_COPY: Record<Section, { label: string; shortLabel?: string; description: string }> = {
  poczta: {
    label: "Poczta dostawców",
    shortLabel: "Poczta",
    description:
      "Maile od dostawców jako sprawy na tablicy: do zrobienia, w trakcie, czekam, faktury do wpisania do Subiekta i przedpłaty do przekazania do zapłaty. Nowe maile dociągają się z Gmaila po wejściu.",
  },
  oc: {
    label: "Kontrola OC",
    description: "Potwierdzenia zamówień porównane pozycja po pozycji z wysłanym ZD.",
  },
  raporty: {
    label: "Raporty",
    description: "Raporty rutyn w chmurze: poranny przegląd skrzynki i kontrola potwierdzeń.",
  },
};

function parseSection(raw: string | undefined): Section {
  return raw === "oc" || raw === "raporty" ? raw : "poczta";
}

export default async function AsystentPage({
  searchParams,
}: {
  searchParams: Promise<{ widok?: string; sekcja?: string; sprawa?: string }>;
}) {
  const user = await requireOperations("read");
  // Raporty dotyczą skrzynki działu zakupów — jak Kreator ZD, tylko admin i zakupy.
  if (user.role !== "admin" && user.role !== "zakupy") notFound();

  const params = await searchParams;
  const section = parseSection(params.sekcja);
  const view = parseOcView(params.widok);
  const sprawa = typeof params.sprawa === "string" ? params.sprawa : null;
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
  const ocList = groups[view];
  const ocSelected = section === "oc" && sprawa ? (checks.find((c) => c.id === sprawa) ?? null) : null;

  // Poczta dostawców: lista z bazy od razu; nowe maile z Gmaila dociąga komponent po wejściu.
  const [mail, conn, signature, paymentForwardEmail] = await Promise.all([
    loadSupplierMailView().catch(() => null),
    getGmailConnection(user.id).catch(() => null),
    getEmailSignature(user.id).catch(() => ""),
    getPaymentForwardEmail(user.id).catch(() => ""),
  ]);
  const mailTodo = mail ? mail.items.filter((i) => i.column === "todo" && (!i.assigneeId || i.assigneeId === user.id)).length : 0;
  const sections: { id: Section; href: string; count: number }[] = [
    { id: "poczta", href: "/zakupy/asystent", count: mailTodo },
    {
      id: "oc",
      href: "/zakupy/asystent?sekcja=oc",
      count: groups["do-ruchu"].length,
    },
    { id: "raporty", href: "/zakupy/asystent?sekcja=raporty", count: 0 },
  ];

  return (
    <div data-assistant-viewport className="relative mx-auto flex w-full max-w-[min(100%,100rem)] flex-col gap-3 sm:gap-4">
      {/* Jedna linia: tytuł z podpowiedzią i przełącznik sekcji — panel pracy zaczyna się jak najwyżej. */}
      <header className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
        <div className="flex min-w-0 items-center gap-1.5">
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Asystent</h1>
          <HelpHintBubble message={SECTION_COPY[section].description} tone="slate" size="md" ariaLabel="O tej sekcji" />
        </div>
        <nav aria-label="Sekcje Asystenta" className="min-w-0 max-w-full">
          <div role="tablist" className="flex max-w-full gap-1 overflow-x-auto rounded-md border border-slate-200/90 bg-slate-50/90 p-0.5">
            {sections.map((s) => {
              const active = s.id === section;
              return (
                <Link
                  key={s.id}
                  href={s.href}
                  role="tab"
                  aria-selected={active}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "inline-flex min-h-9 shrink-0 items-center gap-2 rounded-[5px] px-3 text-sm font-medium transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/45",
                    active
                      ? "bg-white text-slate-900 shadow-sm ring-1 ring-slate-200/70"
                      : "text-slate-600 hover:bg-white/70 hover:text-slate-900",
                  )}
                >
                  {SECTION_COPY[s.id].shortLabel ? (
                    <>
                      <span className="sm:hidden">{SECTION_COPY[s.id].shortLabel}</span>
                      <span className="hidden sm:inline">{SECTION_COPY[s.id].label}</span>
                    </>
                  ) : (
                    SECTION_COPY[s.id].label
                  )}
                  {s.count > 0 ? <RailCount value={s.count} tone="attention" /> : null}
                </Link>
              );
            })}
          </div>
        </nav>
      </header>

      <section
        aria-label={SECTION_COPY[section].label}
        className="flex min-h-0 flex-col overflow-hidden rounded-[var(--radius-panel)] border border-slate-200 bg-[var(--card)] shadow-[var(--shadow-card-elevated)] lg:flex-1"
      >
        {section === "poczta" ? (
          mail ? (
            <SupplierMailWorkspace
              initialView={mail}
              initialMe={conn?.email ?? null}
              initialMeId={user.id}
              initialCanReply={Boolean(conn)}
              initialSignature={signature}
              initialPaymentForwardEmail={paymentForwardEmail}
              initialSelectedKey={sprawa}
              initialAiAvailable={isCustomsAiConfigured()}
            />
          ) : (
            <div className="p-4 sm:p-6">
              <Alert tone="error">
                Nie udało się wczytać poczty dostawców. Sprawdź, czy migracje 178_supplier_mail i 183_mail_board zostały uruchomione.
              </Alert>
            </div>
          )
        ) : null}

        {section === "oc" ? (
          <div className={workspaceGridClass}>
            <nav aria-label="Widok spraw kontroli OC" className={railClass}>
              <p className={cn(railGroupLabelClass, "hidden 2xl:block")}>Sprawy</p>
              <div
                role="tablist"
                aria-label="Widok spraw kontroli OC"
                className="flex min-w-0 gap-1 overflow-x-auto lg:shrink-0 lg:overflow-visible 2xl:flex-col"
              >
                {OC_VIEWS.map((v) => {
                  const active = v === view;
                  return (
                    <Link
                      key={v}
                      href={ocCheckHref(v)}
                      role="tab"
                      aria-selected={active}
                      title={OC_VIEW_COPY[v].hint}
                      className={railItemClass(active)}
                    >
                      {OC_VIEW_COPY[v].label}
                      <RailCount value={groups[v].length} tone={v === "do-ruchu" ? "attention" : "neutral"} />
                    </Link>
                  );
                })}
              </div>
            </nav>

            <div className={cn(listColumnClass, ocSelected ? "hidden lg:block" : "block")}>
              {loadError ? (
                <p role="alert" className="border-b border-red-200 bg-red-50 px-4 py-2 text-xs text-red-800">
                  {loadError}
                </p>
              ) : null}
              {ocList.length > 0 ? (
                <OcCheckList checks={ocList} view={view} selectedId={ocSelected?.id ?? null} />
              ) : (
                <DetailEmpty
                  icon={<IconClipboardList size={22} />}
                  title={OC_VIEW_COPY[view].emptyTitle}
                  hint={OC_VIEW_COPY[view].emptyHint}
                  className="min-h-[14rem]"
                />
              )}
            </div>

            <div className={cn("flex min-h-0 flex-col lg:overflow-y-auto", ocSelected ? "flex" : "hidden lg:flex")}>
              {ocSelected ? (
                <OcCheckDetail check={ocSelected} backHref={ocCheckHref(view)} />
              ) : (
                <>
                  {ocList.length ? (
                    <DetailEmpty
                      icon={<IconClipboardList size={22} />}
                      title="Wybierz sprawę z listy"
                      hint="Zobaczysz, które pozycje różnią się od ZD, i oznaczysz sprawę jako wyjaśnioną."
                      className="flex-1"
                    />
                  ) : (
                    <div className="flex-1 px-4 py-5 text-sm leading-relaxed text-slate-600 sm:px-5">
                      Rutyna porównuje potwierdzenia z ZD w dni robocze o 9:07, 11:07, 13:07 i 15:07. Sprawy do decyzji trafiają do „Do
                      ruchu”, zgodne potwierdzenia do „Zgodne”.
                    </div>
                  )}
                  <div className="shrink-0 border-t border-slate-200 px-4 py-3 sm:px-5">
                    <details className="group">
                      <summary className="cursor-pointer list-none text-sm font-medium text-slate-700 transition-colors hover:text-slate-900 [&::-webkit-details-marker]:hidden">
                        <IconChevronRight
                          size={14}
                          aria-hidden
                          className="mr-1 inline-block text-slate-400 transition-transform group-open:rotate-90"
                        />
                        Import wyników kontroli
                      </summary>
                      <p className="mt-2 mb-3 text-sm leading-relaxed text-slate-600">
                        Do czasu odczytu Gmaila w OnTime wyniki z rutyny wklejasz tutaj. Ponowny import tej samej sprawy aktualizuje
                        porównanie, ale nie zmienia decyzji „Wyjaśnione”.
                      </p>
                      <OcCheckImportForm />
                    </details>
                  </div>
                </>
              )}
            </div>
          </div>
        ) : null}

        {section === "raporty" ? (
          <div className="min-h-0 p-4 sm:p-6 lg:overflow-y-auto">
            <ul className="grid max-w-4xl gap-4 md:grid-cols-2">
              {reports.map((report) => (
                <li key={report.key} className="flex flex-col gap-4 rounded-lg border border-slate-200 p-5">
                  <div className="space-y-1.5">
                    <h2 className="text-base font-semibold tracking-tight text-slate-900">{report.title}</h2>
                    <p className="text-sm leading-relaxed text-slate-600">{report.description}</p>
                    <p className="flex items-center gap-1.5 text-xs text-slate-500 tabular-nums">
                      <IconClock size={14} aria-hidden className="text-slate-400" />
                      {report.schedule}
                    </p>
                  </div>
                  <div className="mt-auto">
                    {report.url ? (
                      <a
                        href={report.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={cn(
                          buttonPrimaryClass,
                          "inline-flex min-h-10 items-center rounded-md px-4 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/45 focus-visible:ring-offset-1",
                        )}
                      >
                        Otwórz raport
                      </a>
                    ) : (
                      <p className="text-sm text-slate-500">
                        Link nie jest skonfigurowany. Ustaw <code className="font-mono text-xs">{report.envVar}</code> w .env serwera.
                      </p>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </section>
    </div>
  );
}
