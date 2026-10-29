"use client";

import { Fragment, useEffect, useMemo, useState, useTransition } from "react";
import {
  actionFetchSubiektLeadTimesReport,
  actionSyncSubiektLeadTimes,
} from "@/app/actions/admin";
import { IconChevronDown } from "@/components/icons/StrokeIcons";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { Input } from "@/components/ui/Field";
import { HelpBlock } from "@/components/ui/HelpBlock";
import { HelpPopover } from "@/components/ui/HelpPopover";
import { NoticeToast } from "@/components/ui/NoticeToast";
import { AdminMetrics } from "@/components/admin/AdminMetrics";
import { BrandLoader } from "@/components/ui/BrandLoader";
import { polishPluralWord } from "@/lib/email/polish-plural";
import { Spinner } from "@/components/ui/Spinner";
import type {
  SubiektLeadTimeSupplierRow,
  SubiektLeadTimeSupplierStatus,
  SubiektLeadTimesReport,
} from "@/lib/data/subiekt-lead-times-report";
import { cn } from "@/lib/cn";
import { formatWarsawDateTime } from "@/lib/time/warsaw";
import { adminPanelNotice, type ToastNotice } from "@/lib/ui/notice-copy";
import {
  panelChoiceChipClass,
  panelChoiceChipIdleClass,
  panelChoiceChipSelectedClass,
} from "@/lib/ui/ontime-theme";
import { userFacingErrorText } from "@/lib/ui/user-facing-error";
import { askConfirm } from "@/components/ui/ConfirmHost";
import { matchesSearchWords } from "@/lib/search/keywords";

const STATUS: Record<
  SubiektLeadTimeSupplierStatus,
  { label: string; variant: "success" | "info" | "warning" | "default"; hint: string }
> = {
  subiekt: { label: "Subiekt", variant: "success", hint: "ETA liczone z ZD → FZ z ostatnich miesięcy" },
  subiekt_old: { label: "Subiekt (starsze)", variant: "info", hint: "Brak ZD w oknie - użyto najnowszych zamówień z historii" },
  panel_fallback: { label: "Panel", variant: "warning", hint: "Brak ZD w oknie, a panel ma własne pomiary - zostają pomiary z panelu" },
  shared_kh: { label: "Wspólny kontrahent", variant: "warning", hint: "Kilka kart OnTime ma to samo konto w Subiekcie - ZD ich nie rozróżnia, zostają pomiary z panelu" },
  osobno: { label: "Tryb osobno", variant: "default", hint: "Główne i uzupełniające liczone oddzielnie - Subiekt ich nie rozróżnia, zostają pomiary z panelu" },
  no_kh: { label: "Bez powiązania", variant: "default", hint: "Karta dostawcy nie ma kontrahenta z Subiekta" },
  no_data: { label: "Brak ZD", variant: "default", hint: "Brak zrealizowanych ZD u tego kontrahenta" },
};

type Filter = "all" | "subiekt" | "diff" | "other";

const FILTERS: Array<{ id: Filter; label: string }> = [
  { id: "subiekt", label: "Liczone z Subiekta" },
  { id: "diff", label: "Rozbieżne z panelem" },
  { id: "other", label: "Poza Subiektem" },
  { id: "all", label: "Wszyscy" },
];

/** Różnica median ≥ 3 dni robocze — warto sprawdzić (np. zamówienia klikane po fakcie). */
function isDiff(row: SubiektLeadTimeSupplierRow): boolean {
  return (
    row.subiektP50 != null &&
    row.panelP50 != null &&
    row.panelCount >= 3 &&
    Math.abs(row.subiektP50 - row.panelP50) >= 3
  );
}

const days = (v: number | null) => (v == null ? "-" : `${v} d`);
const plDate = (key: string | null) => (key ? key.split("-").reverse().join(".") : "-");

function SupplierRow({ row, expanded, onToggle }: { row: SubiektLeadTimeSupplierRow; expanded: boolean; onToggle: () => void }) {
  const status = STATUS[row.status];
  return (
    <Fragment>
      <tr
        className={cn(
          "cursor-pointer transition-colors hover:bg-slate-50",
          expanded && "bg-indigo-50 hover:bg-indigo-50",
          !row.isActive && "text-slate-500"
        )}
        onClick={onToggle}
      >
        <td className="py-2 pl-3 pr-2 text-sm font-medium text-slate-800 sm:pl-4 lg:pl-5">
          <button
            type="button"
            className="flex items-center gap-1.5 rounded-md text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600"
            aria-expanded={expanded}
            onClick={(e) => {
              e.stopPropagation();
              onToggle();
            }}
          >
            <IconChevronDown open={expanded} size={14} className="shrink-0 text-slate-400" />
            {row.name}
          </button>
        </td>
        <td className="px-2 py-2 sm:px-3">
          <span title={status.hint}>
            <Badge variant={status.variant}>{status.label}</Badge>
          </span>
        </td>
        <td className="px-2 py-2 text-sm tabular-nums font-semibold text-slate-900 sm:px-3">{days(row.subiektP50)}</td>
        <td className="hidden px-2 py-2 text-sm tabular-nums text-slate-700 sm:table-cell sm:px-3">{days(row.subiektP90)}</td>
        <td className="hidden px-2 py-2 text-sm tabular-nums text-slate-700 md:table-cell sm:px-3">{row.subiektWindow || "-"}</td>
        <td className={cn("hidden px-2 py-2 text-sm tabular-nums md:table-cell sm:px-3", isDiff(row) ? "font-semibold text-amber-700" : "text-slate-700")}>
          {row.panelCount ? `${days(row.panelP50)} · n=${row.panelCount}` : "-"}
        </td>
        <td className="hidden px-2 py-2 text-sm tabular-nums text-slate-700 lg:table-cell sm:px-3">{days(row.etaAvg)}</td>
        <td className="hidden px-2 py-2 text-xs tabular-nums text-slate-500 lg:table-cell sm:px-3">{plDate(row.lastZdDate)}</td>
      </tr>
      {expanded ? (
        <tr className="bg-slate-50">
          <td colSpan={8} className="px-3 py-3 sm:px-4 lg:px-5">
            <div className="grid gap-3 text-xs text-slate-600 sm:grid-cols-2">
              <div className="space-y-1">
                <p>{status.hint}.</p>
                <p>
                  Pierwsza dostawa (część towaru): <strong className="text-slate-800">{days(row.subiektFirstP50)}</strong>
                  {" · "}pełna (z brakami): <strong className="text-slate-800">{days(row.subiektP50)}</strong>
                </p>
                <p>
                  Cała historia z Subiekta: <strong className="text-slate-800">{row.subiektAll}</strong> zamówień
                  {row.correctedWindow
                    ? ` · ${row.correctedWindow} z ostatniego okna z datą FZ poprawioną po zamknięciu miesiąca`
                    : ""}
                </p>
              </div>
              {row.trend.length ? (
                <div>
                  <p className="mb-1.5 font-medium text-slate-700">Mediana w latach</p>
                  <div className="flex flex-wrap gap-1.5">
                    {row.trend.map((t) => (
                      <span
                        key={t.year}
                        className="rounded-md bg-card px-2 py-1 tabular-nums ring-1 ring-inset ring-slate-200"
                        title={`${t.n} zamówień w ${t.year}`}
                      >
                        {t.year}: <strong className="text-slate-800">{t.p50} d</strong>
                        <span className="text-slate-500"> · {t.n}</span>
                      </span>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          </td>
        </tr>
      ) : null}
    </Fragment>
  );
}

export function SubiektLeadTimesPanel({ initialData }: { initialData: SubiektLeadTimesReport | null }) {
  const [data, setData] = useState(initialData);
  const [filter, setFilter] = useState<Filter>("subiekt");
  const [search, setSearch] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showUnmapped, setShowUnmapped] = useState(false);
  const [toast, setToast] = useState<ToastNotice | null>(null);
  const [running, setRunning] = useState<"full" | "incremental" | null>(
    initialData?.running ? "full" : null
  );
  const [, startTransition] = useTransition();

  const notify = (text: string, tone: "success" | "error" = "success") =>
    setToast(adminPanelNotice(text, tone));

  async function refresh() {
    const res = await actionFetchSubiektLeadTimesReport();
    setData(res.data);
    return res.data;
  }

  // Pełna historia biegnie w tle (dłużej niż timeout proxy) — odpytujemy stan do końca.
  useEffect(() => {
    if (running !== "full") return;
    let cancelled = false;
    const startedAt = data?.state?.at ?? null;
    const timer = window.setInterval(async () => {
      try {
        const next = await refresh();
        if (cancelled || next.running) return;
        setRunning(null);
        if (next.state && next.state.at !== startedAt) {
          if (next.state.ok) notify(`Pełna historia gotowa - zmierzono ${next.state.samplesAssigned} zamówień.`);
          else notify(next.state.error ?? "Synchronizacja nie powiodła się.", "error");
        }
      } catch {
        /* chwilowy błąd sieci — kolejna próba za 10 s */
      }
    }, 10_000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- tylko start/stop pollingu
  }, [running]);

  async function sync(mode: "full" | "incremental") {
    if (
      mode === "full" &&
      !(await askConfirm({
        title: "Pobrać całą historię?",
        message: "ZD i FZ z Subiekta od 2006. Trwa ok. 5 minut - Subiekt musi być dostępny w sieci.",
        confirmLabel: "Pobierz",
      }))
    ) {
      return;
    }
    setRunning(mode);
    startTransition(async () => {
      try {
        const res = await actionSyncSubiektLeadTimes(mode);
        if ("error" in res && res.error) {
          notify(res.error, "error");
          setRunning(null);
          return;
        }
        if ("started" in res && res.started) {
          notify("Pobieranie całej historii ruszyło w tle - potrwa ok. 5 minut, panel odświeży się sam.");
          return; // polling w useEffect zdejmie stan „running”
        }
        notify(`Gotowe - zmierzono ${"count" in res ? res.count : 0} zamówień, czasy dostaw przeliczone.`);
        await refresh();
        setRunning(null);
      } catch (e) {
        notify(userFacingErrorText(e, "Synchronizacja nie powiodła się."), "error");
        setRunning(null);
      }
    });
  }

  const rows = useMemo(() => {
    if (!data) return [];
    const q = search.trim().toLowerCase();
    return data.suppliers.filter((row) => {
      if (!matchesSearchWords(row.name, q)) return false;
      if (filter === "subiekt") return row.status === "subiekt" || row.status === "subiekt_old";
      if (filter === "diff") return isDiff(row);
      if (filter === "other") return row.status !== "subiekt" && row.status !== "subiekt_old" && row.isActive;
      return true;
    });
  }, [data, filter, search]);

  const state = data?.state ?? null;
  const fromSubiekt = data?.suppliers.filter((r) => r.status === "subiekt" || r.status === "subiekt_old").length ?? 0;
  const diffCount = data?.suppliers.filter(isDiff).length ?? 0;
  // Pusta kopia: przyrost (18 mies.) nie wystarczy — pierwszy krok to pełna historia.
  const firstRun = data != null && data.docs.zd + data.docs.fz === 0;

  return (
    <>
      {toast ? <NoticeToast notice={toast} onDismiss={() => setToast(null)} /> : null}
      <Card padding={false} className="overflow-hidden">
        <CardHeader
          inset
          density="compact"
          title="Czasy dostaw z Subiekta (ZD → FZ)"
          description="Prawdziwe daty: od wystawienia ZD do przyjęcia towaru na FZ. Zastępują pomiary z kliknięć w panelu tam, gdzie da się jednoznacznie przypisać dostawcę."
          action={
            <HelpPopover label="Pomoc - czasy dostaw z Subiekta" title="Jak liczymy" shortLabel="Pomoc">
              <HelpBlock title="Start i koniec">
                <ul className="list-disc space-y-1.5 pl-4 text-xs">
                  <li>Start: data wystawienia ZD (ZD jest wysyłane od razu).</li>
                  <li>Koniec: data przyjęcia na magazyn z FZ zrobionej z tego ZD.</li>
                  <li>
                    FZ wpisana po zamknięciu miesiąca z datą ostatniego dnia (np. towar 02.10, FZ 30.09) -
                    dzień wpisu odczytujemy z numeracji dokumentów w Subiekcie i liczymy do niego.
                  </li>
                  <li>Dni robocze (bez weekendów i świąt), jak w całym ETA.</li>
                </ul>
              </HelpBlock>
              <HelpBlock title="Braki i realizacje częściowe">
                <p className="text-xs">
                  Resztę zamówienia Subiekt przenosi do ZD „braki”. Cały łańcuch to jedno zamówienie: pierwsza
                  dostawa = pierwsza FZ, pełna = ostatnia FZ. Zamówienie z otwartymi brakami czeka, aż się domknie.
                </p>
              </HelpBlock>
              <HelpBlock title="Które zamówienia liczą się do ETA">
                <p className="text-xs">
                  Ostatnie {data?.windowMonths ?? 24} miesięcy (gdy mniej niż 5 zamówień - dobieramy najnowsze
                  starsze). Synchronizacja nocna pobiera ostatnie 18 miesięcy, pełna - całą historię.
                </p>
              </HelpBlock>
            </HelpPopover>
          }
        />

        <div className="space-y-4 px-3 pb-4 sm:px-4 lg:px-5">
          {!data ? (
            <p className="text-sm text-slate-500">
              Brak danych - uruchom migrację 168 i pełną synchronizację.
            </p>
          ) : (
            <>
              <AdminMetrics
                items={[
                  {
                    label: "Dokumenty w kopii",
                    value: (data.docs.zd + data.docs.fz).toLocaleString("pl-PL"),
                    hint: `${data.docs.zd.toLocaleString("pl-PL")} ZD · ${data.docs.fz.toLocaleString("pl-PL")} FZ · od ${data.docs.oldest?.slice(0, 4) ?? "-"}`,
                  },
                  {
                    label: "Zmierzone zamówienia",
                    value: (state?.samplesAssigned ?? 0).toLocaleString("pl-PL"),
                    hint: state?.counts ? `${state.counts.openOrders} czeka na braki` : undefined,
                  },
                  {
                    label: "Dostawcy z Subiekta",
                    value: fromSubiekt,
                    hint: `${data.unmapped.length} kont bez karty dostawcy`,
                  },
                  {
                    label: "Pominięte: FZ z końca miesiąca",
                    value: (state?.counts?.monthEndExcluded ?? 0).toLocaleString("pl-PL"),
                    hint: "data wpisu po zamknięciu miesiąca, nie przyjęcia",
                  },
                  {
                    label: "Rozbieżne z panelem",
                    value: diffCount,
                    hint: "mediana różni się o ≥ 3 dni",
                    tone: diffCount ? "warning" : "default",
                    onClick: () => setFilter("diff"),
                    actionLabel: `Pokaż ${diffCount} rozbieżnych z panelem`,
                  },
                ]}
              />

              {running === "full" ? (
                <div role="status" className="flex items-center gap-2 text-sm text-slate-600">
                  <BrandLoader size="sm" tile={false} />
                  Pobieram całą historię ZD i FZ z Subiekta. Zwykle trwa to ok. 5 minut; tabela odświeży się sama.
                </div>
              ) : null}

              {firstRun ? (
                <div className="flex flex-wrap items-center gap-3 rounded-lg bg-indigo-50 px-3.5 py-3">
                  <p className="min-w-0 flex-1 text-sm text-slate-800">
                    <strong className="font-semibold">Kopia ZD/FZ jest pusta.</strong> Wczytaj raz całą historię z
                    Subiekta (ok. 5 min) - dopiero wtedy czasy dostaw liczą się z prawdziwych dat, a nie z kliknięć w
                    panelu. Potem co noc dociąga się samo.
                  </p>
                  <Button size="sm" disabled={running != null} onClick={() => sync("full")}>
                    {running === "full" ? (
                      <>
                        <Spinner size="sm" />
                        Wczytuję historię (ok. 5 min)…
                      </>
                    ) : (
                      "Wczytaj historię z Subiekta"
                    )}
                  </Button>
                </div>
              ) : null}

              <div className={cn("flex flex-wrap items-center gap-2", firstRun && "hidden")}>
                <Button size="sm" disabled={running != null} onClick={() => sync("incremental")}>
                  {running === "incremental" ? (
                    <>
                      <Spinner size="sm" />
                      Synchronizacja…
                    </>
                  ) : (
                    "Synchronizuj teraz"
                  )}
                </Button>
                <Button size="sm" variant="secondary" disabled={running != null} onClick={() => sync("full")}>
                  {running === "full" ? (
                    <>
                      <Spinner size="sm" />
                      Pobieranie całej historii (ok. 5 min)…
                    </>
                  ) : (
                    "Pełna historia od 2006"
                  )}
                </Button>
                <span className={cn("text-xs", state && !state.ok ? "text-red-600" : "text-slate-500")}>
                  {state
                    ? `${state.ok ? "Ostatnia synchronizacja" : "Błąd synchronizacji"}: ${formatWarsawDateTime(state.at)} · ${
                        state.mode === "full" ? "pełna" : "18 mies."
                      }${state.ok ? ` · ${Math.round(state.durationMs / 1000)} s` : ` - ${state.error ?? ""}`}`
                    : "Jeszcze nie synchronizowano"}
                </span>
              </div>

            </>
          )}
        </div>

        {data ? (
          <>
              <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 px-3 py-3 sm:px-4 lg:px-5">
                <Input
                  type="search"
                  aria-label="Szukaj dostawcy"
                  placeholder="Szukaj dostawcy…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full sm:max-w-xs"
                />
                <div className="flex flex-wrap gap-1.5" role="group" aria-label="Źródło ETA">
                  {FILTERS.map((chip) => (
                    <button
                      key={chip.id}
                      type="button"
                      aria-pressed={filter === chip.id}
                      className={cn(
                        panelChoiceChipClass,
                        "min-h-9 px-2.5 py-1.5",
                        filter === chip.id ? panelChoiceChipSelectedClass : panelChoiceChipIdleClass
                      )}
                      onClick={() => setFilter(chip.id)}
                    >
                      {chip.label}
                    </button>
                  ))}
                </div>
                <p className="ml-auto text-[0.6875rem] tabular-nums text-slate-500">
                  {rows.length} {polishPluralWord(rows.length, "dostawca", "dostawcy", "dostawców")}
                </p>
              </div>

              <div className="overflow-x-auto border-t border-slate-200">
                <table className="min-w-full text-left">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50 text-[0.8125rem] text-slate-500">
                      <th className="py-2.5 pl-3 pr-2 font-medium sm:pl-4 lg:pl-5">Dostawca</th>
                      <th className="px-2 py-2.5 font-medium sm:px-3">Źródło ETA</th>
                      <th className="px-2 py-2.5 font-medium sm:px-3" title="Mediana dni roboczych do pełnej dostawy">Typowo</th>
                      <th className="hidden px-2 py-2.5 font-medium sm:table-cell sm:px-3" title="9 na 10 zamówień przychodzi w tym czasie">Najdłużej (p90)</th>
                      <th className="hidden px-2 py-2.5 font-medium md:table-cell sm:px-3">Zamówień</th>
                      <th className="hidden px-2 py-2.5 font-medium md:table-cell sm:px-3" title="Mediana z kliknięć w panelu (dla porównania)">Panel</th>
                      <th className="hidden px-2 py-2.5 font-medium lg:table-cell sm:px-3" title="Średnia z delivery_stats (po przeliczeniu). Terminy w ETA liczone są z mediany, gdy włączona jest flaga p50.">Średnia</th>
                      <th className="hidden px-2 py-2.5 font-medium lg:table-cell sm:px-3">Ostatnie ZD</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-card">
                    {rows.length ? (
                      rows.map((row) => (
                        <SupplierRow
                          key={row.supplierId}
                          row={row}
                          expanded={expandedId === row.supplierId}
                          onToggle={() => setExpandedId((id) => (id === row.supplierId ? null : row.supplierId))}
                        />
                      ))
                    ) : (
                      <tr>
                        <td colSpan={8} className="px-3 py-8 text-center text-sm text-slate-500">
                          Brak dostawców pasujących do filtrów.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {data.unmapped.length ? (
                <div className="border-t border-slate-200">
                  <button
                    type="button"
                    className="flex min-h-11 w-full items-center justify-between gap-3 px-3 py-2.5 text-left text-sm font-medium text-slate-700 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-indigo-600 sm:px-4 lg:px-5"
                    aria-expanded={showUnmapped}
                    onClick={() => setShowUnmapped((v) => !v)}
                  >
                    <span>
                      Konta z Subiekta bez karty dostawcy ({data.unmapped.length})
                      <span className="ml-2 text-xs font-normal text-slate-500">
                        ZD z ostatnich {data.windowMonths} mies. - przypisz kontrahenta na karcie dostawcy, by liczyć je w ETA
                      </span>
                    </span>
                    <IconChevronDown open={showUnmapped} size={14} className="shrink-0 text-slate-400" />
                  </button>
                  {showUnmapped ? (
                    <ul className="divide-y divide-slate-100 border-t border-slate-100 text-xs">
                      {data.unmapped.map((u) => (
                        <li key={u.khId} className="flex items-center justify-between gap-3 px-3 py-1.5 sm:px-4 lg:px-5">
                          <span className="font-medium text-slate-700">
                            {u.khSymbol ?? "?"} <span className="font-normal text-slate-500">kh_Id {u.khId}</span>
                          </span>
                          <span className="tabular-nums text-slate-500">
                            {u.orders} ZD · ostatnie {plDate(u.lastZdDate)}
                          </span>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </div>
              ) : null}
          </>
        ) : null}
      </Card>
    </>
  );
}
