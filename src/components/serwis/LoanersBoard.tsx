"use client";

import { useAdminPanelPreview } from "@/components/layout/AdminPanelPreviewContext";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Kbd } from "@/components/ui/Kbd";
import { NoticeToast } from "@/components/ui/NoticeToast";
import { IconPackageCheck, IconPlus, IconSearch } from "@/components/icons/StrokeIcons";
import { cn } from "@/lib/cn";
import { polishPlural, polishPluralWord } from "@/lib/email/polish-plural";
import { controlFocusClass } from "@/lib/ui/ontime-theme";
import { rubricBoxClass, rubricHeadClass, rubricLabelClass, serwisFilterActiveClass, serwisFilterIdleClass } from "@/lib/ui/serwis-theme";
import {
  addDays,
  daysBetween,
  groupLoanersByModel,
  LOANER_STATE_LABEL,
  LOANER_STATE_RANK,
  loanerSpans,
  loanerViewState,
  parseDateOnly,
  type LoanerEvent,
  type LoanerUnit,
  type LoanerViewState,
} from "@/lib/orders/service-loaners";
import { LoanerIssueDialog } from "@/components/serwis/LoanerIssueDialog";
import { LoanerAddDialog } from "@/components/serwis/LoanerAddDialog";
import { LoanerDrawer } from "@/components/serwis/LoanerDrawer";

export type LoanerUnitView = LoanerUnit & {
  state: LoanerViewState;
  events: LoanerEvent[];
  stints: ReturnType<typeof loanerSpans>["stints"];
  service: ReturnType<typeof loanerSpans>["service"];
  daysOut: number | null;
};

const STATE_DOT: Record<LoanerViewState, string> = {
  free: "bg-emerald-600",
  out: "bg-primary",
  warn: "bg-amber-500",
  late: "bg-red-600",
  svc: "bg-slate-300",
  retired: "bg-slate-200",
};

export const STATE_PILL: Record<LoanerViewState, string> = {
  free: "bg-emerald-50 text-emerald-800",
  out: "bg-indigo-50 text-indigo-800",
  warn: "bg-amber-50 text-amber-900",
  late: "bg-red-50 text-red-800",
  svc: "bg-slate-100 text-slate-600",
  retired: "bg-slate-100 text-slate-500",
};

export function StatePill({ state }: { state: LoanerViewState }) {
  return (
    <span className={cn("inline-flex h-6 items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 text-xs font-semibold", STATE_PILL[state])}>
      <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden />
      {LOANER_STATE_LABEL[state]}
    </span>
  );
}

export function formatShort(iso: string): string {
  return new Date(iso).toLocaleDateString("pl-PL", { day: "2-digit", month: "2-digit" });
}

export function formatLong(iso: string): string {
  return new Date(iso).toLocaleDateString("pl-PL", { day: "numeric", month: "long", year: "numeric" });
}

function shortClient(name: string): string {
  return name.split(",")[0]!.trim();
}

/* ---------- Oś obłożenia ---------- */

const PAST_DAYS = 56;
const FUTURE_DAYS = 21;

function Timeline({
  groups,
  today,
  onOpen,
}: {
  groups: { twId: number; name: string; units: LoanerUnitView[] }[];
  today: Date;
  onOpen: (id: string) => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const from = addDays(today, -PAST_DAYS);
  const span = PAST_DAYS + FUTURE_DAYS;
  const pct = (d: Date | string) => Math.max(0, Math.min(100, (daysBetween(from, d) / span) * 100));
  const todayPct = pct(today);
  // Bez podziałki tuż przy „dziś” — inaczej oba podpisy nachodzą na siebie.
  const ticks = Array.from({ length: Math.floor(span / 7) + 1 }, (_, i) => addDays(from, i * 7)).filter(
    (d) => Math.abs(daysBetween(d, today)) > 3
  );
  const weekends = Array.from({ length: span }, (_, i) => addDays(from, i)).filter((d) => d.getDay() === 0 || d.getDay() === 6);

  const todayRef = useRef<HTMLSpanElement>(null);

  // „Dziś” ok. 2/3 szerokości widoku: widać ostatnie tygodnie i najbliższe zwroty, także na telefonie.
  useEffect(() => {
    const el = scrollRef.current;
    const mark = todayRef.current;
    if (!el || !mark) return;
    const x = mark.getBoundingClientRect().left - el.getBoundingClientRect().left + el.scrollLeft;
    el.scrollLeft = Math.max(0, x - el.clientWidth * 0.65);
  }, []);

  return (
    <div ref={scrollRef} className="overflow-x-auto">
      <div className="grid min-w-[60rem] grid-cols-[15rem_minmax(45rem,1fr)] max-sm:min-w-[48rem] max-sm:grid-cols-[9.5rem_minmax(38rem,1fr)]">
        <div className="sticky left-0 z-10 h-9 border-b border-r border-[var(--sv-rule)] bg-card" />
        <div className="relative h-9 border-b border-[var(--sv-rule)]">
          {ticks.map((d) => (
            <span key={d.toISOString()} className="absolute top-2.5 -translate-x-1/2 whitespace-nowrap text-[0.6875rem] text-slate-500" style={{ left: `${pct(d)}%` }}>
              {formatShort(d.toISOString())}
            </span>
          ))}
          <span ref={todayRef} className="absolute top-2.5 -translate-x-1/2 text-[0.6875rem] font-semibold text-indigo-700" style={{ left: `${todayPct}%` }}>
            dziś
          </span>
        </div>

        {groups.map((g) => (
          <div key={g.twId} className="contents">
            <div className="col-span-2 border-b border-[var(--sv-rule)] px-4 pb-1.5 pt-3.5 text-[0.8125rem] font-semibold text-slate-700">
              <span className="sticky left-4">
                {g.name} · {g.units.length}
              </span>
            </div>
            {g.units.map((u) => {
              const sub =
                u.state === "free"
                  ? `na stanie · ${u.condition}`
                  : u.state === "svc"
                    ? "w przeglądzie"
                    : `${shortClient(u.currentClientName ?? "-")} · ${u.daysOut} ${polishPluralWord(u.daysOut ?? 0, "dzień", "dni", "dni")}`;
              return (
                <div key={u.id} className="group contents">
                  <button
                    type="button"
                    onClick={() => onOpen(u.id)}
                    className={cn("sticky left-0 z-10 flex h-[52px] min-w-0 items-center gap-2.5 border-b border-r border-[var(--sv-rule)] bg-card px-4 text-left transition-colors duration-150 group-hover:bg-[var(--sv-box)]", controlFocusClass)}
                  >
                    <span className={cn("h-2 w-2 flex-none rounded-full", STATE_DOT[u.state])} aria-hidden />
                    <span className="flex min-w-0 flex-col">
                      <span className="font-mono text-xs font-semibold text-slate-900">{u.code}</span>
                      <span className="text-xs leading-snug text-slate-500">{sub}</span>
                    </span>
                  </button>
                  <div
                    role="button"
                    tabIndex={-1}
                    aria-hidden
                    onClick={() => onOpen(u.id)}
                    className="relative h-[52px] cursor-pointer border-b border-[var(--sv-rule)] transition-colors duration-150 group-hover:bg-[var(--sv-box)]"
                  >
                    {weekends.map((d) => (
                      <div key={d.toISOString()} className="absolute inset-y-0 bg-[var(--sv-box)]" style={{ left: `${pct(d)}%`, width: `${100 / span}%` }} />
                    ))}
                    {u.service.map((s) => (
                      <div
                        key={s.from}
                        className="absolute top-3.5 flex h-6 items-center overflow-hidden rounded-md border border-slate-200 bg-slate-100 px-2 text-[0.6875rem] text-slate-500"
                        style={{ left: `${pct(s.from)}%`, width: `${Math.max(pct(s.to ?? today) - pct(s.from), 1.5)}%` }}
                        title="Przegląd"
                      >
                        serwis
                      </div>
                    ))}
                    {u.stints.map((s) => {
                      const live = !s.to;
                      const days = daysBetween(s.from, s.to ?? today);
                      const left = pct(s.from);
                      const width = Math.max(pct(s.to ?? today) - left, 1.4);
                      const plan = live && s.plannedReturn && parseDateOnly(s.plannedReturn) > today ? parseDateOnly(s.plannedReturn) : null;
                      // Planowany zwrot zaczyna się za paskiem wydania (świeże wydanie ma minimalną szerokość paska).
                      const planLeft = Math.max(todayPct, left + width);
                      const planW = plan ? pct(plan) - planLeft : 0;
                      return (
                        <div key={s.from} className="contents">
                          {plan && planW > 0 ? (
                            <div
                              className="absolute top-3.5 flex h-6 items-center overflow-hidden whitespace-nowrap rounded-md border border-dashed border-slate-300 px-2 text-[0.6875rem] text-slate-500"
                              style={{ left: `${planLeft}%`, width: `${planW}%` }}
                              title={`Planowany zwrot ${formatShort(plan.toISOString())}`}
                            >
                              {planW > 7 ? `zwrot ${formatShort(plan.toISOString())}` : ""}
                            </div>
                          ) : null}
                          <div
                            className={cn(
                              "absolute top-3.5 flex h-6 items-center gap-1.5 overflow-hidden whitespace-nowrap rounded-md px-2 text-xs font-medium",
                              !live && "border border-slate-200 bg-slate-50 text-slate-500",
                              live && u.state === "late" && "bg-red-600 text-white",
                              live && u.state === "warn" && "bg-amber-500 text-amber-950",
                              live && u.state === "out" && "bg-primary text-white"
                            )}
                            style={{ left: `${left}%`, width: `${width}%` }}
                            title={`${s.clientName}: ${days} ${polishPluralWord(days, "dzień", "dni", "dni")}`}
                          >
                            {width > 2.5 ? <span className="font-mono text-[0.6875rem] font-semibold">{days}d</span> : null}
                            {width > 6 ? <span>{shortClient(s.clientName)}</span> : null}
                          </div>
                        </div>
                      );
                    })}
                    <div className="absolute inset-y-0 w-0.5 bg-primary/80" style={{ left: `${todayPct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ---------- Lista ---------- */

function LoanerList({ units, onOpen }: { units: LoanerUnitView[]; onOpen: (id: string) => void }) {
  const rows = [...units].sort((a, b) => LOANER_STATE_RANK[a.state] - LOANER_STATE_RANK[b.state] || a.code.localeCompare(b.code));
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[46rem] border-collapse text-sm">
        <thead>
          <tr className="bg-[var(--sv-box)] text-left">
            <th className={cn(rubricLabelClass, "px-4 py-2.5")}>Egzemplarz</th>
            <th className={cn(rubricLabelClass, "px-4 py-2.5")}>Model</th>
            <th className={cn(rubricLabelClass, "px-4 py-2.5")}>Status</th>
            <th className={cn(rubricLabelClass, "px-4 py-2.5")}>U kogo</th>
            <th className={cn(rubricLabelClass, "px-4 py-2.5 text-right")}>Dni</th>
            <th className={cn(rubricLabelClass, "px-4 py-2.5")}>Zwrot</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((u) => (
            <tr key={u.id} onClick={() => onOpen(u.id)} className="cursor-pointer border-t border-[var(--sv-rule)] transition-colors duration-150 hover:bg-[var(--sv-box)]">
              <td className="px-4 py-3">
                <button type="button" onClick={() => onOpen(u.id)} className={cn("min-h-11 font-mono text-[0.8125rem] font-semibold text-indigo-800 underline underline-offset-2", controlFocusClass)}>
                  {u.code}
                </button>
                {u.serialNo ? <div className="text-xs text-slate-500">SN {u.serialNo}</div> : null}
              </td>
              <td className="px-4 py-3 text-slate-700">{u.twName}</td>
              <td className="px-4 py-3">
                <StatePill state={u.state} />
              </td>
              <td className="px-4 py-3 text-slate-700">{u.currentClientName ?? "-"}</td>
              <td className="px-4 py-3 text-right font-mono tabular-nums">{u.daysOut ?? "-"}</td>
              <td className="px-4 py-3 tabular-nums text-slate-600">{u.plannedReturn ? formatShort(parseDateOnly(u.plannedReturn).toISOString()) : "-"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Zdanie stanu pod tytułem: najpierw zwroty, których trzeba dopilnować; nazwy jak w „Do zrobienia”. */
function loanersStateSentence(late: number, dueSoon: number, out: number, free: number): string {
  const parts: string[] = [];
  if (late) parts.push(`${late} po terminie zwrotu`);
  if (dueSoon) parts.push(`${dueSoon} do zwrotu w 3 dni`);
  if (!parts.length) parts.push("Nic po terminie");
  parts.push(`${out} u ${polishPluralWord(out, "klienta", "klientów", "klientów")}`);
  parts.push(`${free} na stanie`);
  return parts.join(" · ");
}

const todoChipClass =
  "inline-flex min-h-11 max-w-full items-center gap-2 rounded-md border px-3 py-1 text-left text-[0.8125rem] transition-colors duration-150";

/* ---------- Plansza ---------- */

export function LoanersBoard({
  units,
  events,
  orderByUnit = {},
}: {
  units: LoanerUnit[];
  events: LoanerEvent[];
  /** Numer zlecenia serwisowego po id egzemplarza. */
  orderByUnit?: Record<string, { id: string; number: string }>;
}) {
  const router = useRouter();
  const [, startRefresh] = useTransition();
  const [view, setView] = useState<"tl" | "list">("tl");
  const [model, setModel] = useState<number | null>(null);
  const [query, setQuery] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);
  const [issueFor, setIssueFor] = useState<string | null | undefined>(undefined);
  const [adding, setAdding] = useState(false);
  const { readOnly } = useAdminPanelPreview();
  const [toast, setToast] = useState<string | null>(null);
  const [today] = useState(() => new Date());
  const searchRef = useRef<HTMLInputElement>(null);

  const views: LoanerUnitView[] = useMemo(() => {
    const byUnit = new Map<string, LoanerEvent[]>();
    for (const e of events) {
      const l = byUnit.get(e.unitId) ?? [];
      l.push(e);
      byUnit.set(e.unitId, l);
    }
    return units.map((u) => {
      const ev = byUnit.get(u.id) ?? [];
      const { stints, service } = loanerSpans(ev);
      return {
        ...u,
        events: ev,
        stints,
        service,
        state: loanerViewState(u, today),
        daysOut: u.currentSince ? daysBetween(u.currentSince, today) : null,
      };
    });
  }, [units, events, today]);

  const allGroups = useMemo(() => groupLoanersByModel(views), [views]);
  const visible = useMemo(() => {
    const q = query.trim().toLocaleLowerCase("pl-PL");
    return views.filter((u) => {
      if (model != null && u.subiektTwId !== model) return false;
      if (!q) return true;
      return `${u.code} ${u.serialNo ?? ""} ${u.twName} ${u.currentClientName ?? ""}`.toLocaleLowerCase("pl-PL").includes(q);
    });
  }, [views, model, query]);
  const groups = useMemo(() => groupLoanersByModel(visible), [visible]);

  const late = views.filter((u) => u.state === "late");
  const warn = views.filter((u) => u.state === "warn");
  const dueSoon = views.filter((u) => {
    if (!u.plannedReturn || u.state === "late" || u.status !== "u_klienta") return false;
    const left = daysBetween(today, parseDateOnly(u.plannedReturn));
    return left >= 0 && left <= 3;
  });

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const typing = (e.target as HTMLElement | null)?.closest("input, textarea, select, [contenteditable=true]");
      if (typing || e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === "/") {
        e.preventDefault();
        searchRef.current?.focus();
      } else if ((e.key === "w" || e.key === "W") && issueFor === undefined && !openId) {
        e.preventDefault();
        setIssueFor(null);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [issueFor, openId]);

  const done = (message: string) => {
    setToast(message);
    startRefresh(() => router.refresh());
  };

  const openUnit = views.find((u) => u.id === openId) ?? null;
  const freeUnits = views.filter((u) => u.state === "free");

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-2">
        <label className="relative block w-full min-w-0 sm:w-auto sm:flex-1 sm:max-w-sm">
          <span className="sr-only">Szukaj egzemplarza lub klienta</span>
          <IconSearch size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            ref={searchRef}
            id="loaners-search"
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Numer, klient, model"
            className="h-11 w-full rounded-lg border border-slate-200 bg-card pl-9 pr-10 text-base shadow-[var(--shadow-control)] transition-colors duration-150 hover:border-slate-300 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 sm:text-sm"
          />
          <span className="pointer-events-none absolute right-2.5 top-1/2 hidden -translate-y-1/2 sm:block">
            <Kbd>/</Kbd>
          </span>
        </label>
        {readOnly ? null : (
        <div className="flex w-full gap-2 sm:ml-auto sm:w-auto [&>*]:flex-1 sm:[&>*]:flex-none">
          <Button type="button" variant="secondary" onClick={() => setAdding(true)}>
            <IconPlus size={18} aria-hidden />
            Dodaj egzemplarz
          </Button>
          <Button type="button" onClick={() => setIssueFor(null)} disabled={freeUnits.length === 0}>
            <IconPackageCheck size={18} aria-hidden />
            Wydaj zamiennik
          </Button>
        </div>
        )}
      </div>

      {views.length === 0 ? (
        <EmptyState
          title="Brak sprzętu zastępczego"
          description="Dodaj pierwszy egzemplarz: wybierz towar z Subiekta i nadaj numer (ZAST-001 albo numer seryjny)."
          action={readOnly ? undefined : <Button type="button" onClick={() => setAdding(true)}>Dodaj egzemplarz</Button>}
        />
      ) : (
        <>
          <p className="font-display text-lg font-bold tracking-[-0.01em] text-slate-900" aria-live="polite">
            {loanersStateSentence(late.length, dueSoon.length, views.filter((u) => u.status === "u_klienta").length, freeUnits.length)}
          </p>

          {/* Karty modeli: treść (dostępność egzemplarzy), a dotknięcie zawęża tablicę do modelu. */}
          <div role="group" aria-label="Filtr modelu" className="-mt-3 grid gap-2 sm:grid-cols-[repeat(auto-fill,minmax(15rem,1fr))] sm:gap-3">
            {allGroups.map((g) => {
              const free = g.units.filter((u) => u.state === "free").length;
              const out = g.units.filter((u) => ["out", "warn", "late"].includes(u.state)).length;
              const gl = g.units.filter((u) => u.state === "late").length;
              const active = model === g.twId;
              return (
                <button
                  key={g.twId}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setModel(active ? null : g.twId)}
                  className={cn(
                    "flex min-w-0 flex-col rounded-lg border text-left transition-colors duration-150",
                    controlFocusClass,
                    active ? serwisFilterActiveClass : cn(serwisFilterIdleClass, "bg-card")
                  )}
                >
                  <span className={cn(rubricHeadClass, "w-full flex-col items-start justify-center gap-0", active && "border-indigo-200")}>
                    <span className="text-sm font-semibold text-slate-900">{g.name}</span>
                    {g.units[0]?.twSymbol ? <span className="font-mono text-[0.6875rem] text-slate-500">{g.units[0].twSymbol}</span> : null}
                  </span>
                  <span className="flex flex-col gap-2 px-3 py-2.5">
                    <span className="flex items-center justify-between gap-2 text-[0.8125rem] text-slate-600">
                      <span>
                        <b className="font-semibold tabular-nums text-slate-900">{free}</b> z {g.units.length} na stanie
                      </span>
                      <span className="flex flex-wrap justify-end gap-1" aria-hidden>
                        {g.units.map((u) => (
                          <span key={u.id} className={cn("h-1.5 w-3.5 rounded-sm", STATE_DOT[u.state])} />
                        ))}
                      </span>
                    </span>
                    <span className="text-xs text-slate-500">
                      {out} u {polishPluralWord(out, "klienta", "klientów", "klientów")}
                      {gl ? <span className="font-semibold text-red-700"> · {gl} po terminie</span> : null}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>

          {late.length || dueSoon.length || warn.length ? (
            <section aria-labelledby="loaners-todo" className={rubricBoxClass}>
              <div className={rubricHeadClass}>
                <h2 id="loaners-todo" className={rubricLabelClass}>
                  Do zrobienia
                </h2>
              </div>
              <div className="flex flex-wrap items-center gap-2 px-3 py-3">
                {late.map((u) => (
                  <button key={u.id} type="button" onClick={() => setOpenId(u.id)} className={cn(todoChipClass, "border-red-200 bg-red-50 text-red-900 hover:bg-red-100", controlFocusClass)}>
                    <span className="h-2 w-2 flex-none rounded-full bg-red-600" aria-hidden />
                    <b className="flex-none whitespace-nowrap font-mono font-semibold">{u.code}</b>
                    {shortClient(u.currentClientName ?? "-")} · {polishPlural(daysBetween(parseDateOnly(u.plannedReturn!), today), "dzień", "dni", "dni")} po terminie
                  </button>
                ))}
                {dueSoon.map((u) => {
                  const left = daysBetween(today, parseDateOnly(u.plannedReturn!));
                  return (
                    <button key={u.id} type="button" onClick={() => setOpenId(u.id)} className={cn(todoChipClass, "border-amber-200 bg-amber-50 text-amber-950 hover:bg-amber-100", controlFocusClass)}>
                      <span className="h-2 w-2 flex-none rounded-full bg-amber-500" aria-hidden />
                      <b className="flex-none whitespace-nowrap font-mono font-semibold">{u.code}</b>
                      zwrot {left === 0 ? "dziś" : left === 1 ? "jutro" : `za ${left} dni`}
                    </button>
                  );
                })}
                {warn.length ? (
                  <span className="inline-flex min-h-8 items-center gap-2 text-[0.8125rem] text-slate-600">
                    <span className="h-2 w-2 flex-none rounded-full bg-amber-500" aria-hidden />
                    {polishPlural(warn.length, "egzemplarz", "egzemplarze", "egzemplarzy")} ponad 14 dni u klienta
                  </span>
                ) : null}
              </div>
            </section>
          ) : null}

          <section aria-label="Obłożenie egzemplarzy" className={cn(rubricBoxClass, "overflow-hidden")}>
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--sv-rule)] px-3 py-2">
              <div className="inline-flex rounded-lg border border-[var(--sv-rule)] bg-[var(--sv-box)] p-0.5" role="group" aria-label="Widok">
                {(["tl", "list"] as const).map((v) => (
                  <button
                    key={v}
                    type="button"
                    aria-pressed={view === v}
                    onClick={() => setView(v)}
                    className={cn(
                      "min-h-11 rounded-md px-4 text-[0.8125rem] font-medium transition-colors duration-150",
                      controlFocusClass,
                      view === v ? "bg-segment-active text-slate-900 shadow-[var(--shadow-control)]" : "text-slate-500 hover:text-slate-800"
                    )}
                  >
                    {v === "tl" ? "Oś czasu" : "Lista"}
                  </button>
                ))}
              </div>
              <div className="flex flex-wrap gap-3.5 text-xs text-slate-500" aria-hidden>
                <span className="inline-flex items-center gap-1.5"><i className="h-2 w-4 rounded-sm bg-primary" />u klienta</span>
                <span className="inline-flex items-center gap-1.5"><i className="h-2 w-4 rounded-sm bg-amber-500" />ponad 14 dni</span>
                <span className="inline-flex items-center gap-1.5"><i className="h-2 w-4 rounded-sm bg-red-600" />po terminie</span>
                <span className="inline-flex items-center gap-1.5"><i className="h-2 w-4 rounded-sm border border-dashed border-slate-300" />planowany zwrot</span>
                <span className="inline-flex items-center gap-1.5"><i className="h-2 w-4 rounded-sm border border-slate-200 bg-slate-50" />wcześniej</span>
              </div>
            </div>
            {visible.length === 0 ? (
              <div className="p-6">
                <EmptyState title="Nic nie pasuje" description="Zmień szukanie albo zdejmij filtr modelu." />
              </div>
            ) : view === "tl" ? (
              <Timeline groups={groups} today={today} onOpen={setOpenId} />
            ) : (
              <LoanerList units={visible} onOpen={setOpenId} />
            )}
          </section>
        </>
      )}

      {openUnit
        ? createPortal(
            <LoanerDrawer
              unit={openUnit}
              today={today}
              order={orderByUnit[openUnit.id] ?? null}
              onClose={() => setOpenId(null)}
              onIssue={() => {
                setOpenId(null);
                setIssueFor(openUnit.id);
              }}
              onDone={done}
            />,
            document.body
          )
        : null}
      {issueFor !== undefined ? (
        <LoanerIssueDialog
          key={issueFor ?? "any"}
          freeUnits={freeUnits}
          preselectId={issueFor}
          today={today}
          onClose={() => setIssueFor(undefined)}
          onDone={(m) => {
            setIssueFor(undefined);
            done(m);
          }}
        />
      ) : null}
      {adding ? (
        <LoanerAddDialog
          onClose={() => setAdding(false)}
          onDone={(m) => {
            setAdding(false);
            done(m);
          }}
        />
      ) : null}
      {toast ? <NoticeToast notice={toast} onDismiss={() => setToast(null)} /> : null}
    </div>
  );
}
