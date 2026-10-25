"use client";

import Link from "next/link";
import { useId, useMemo, useState, useSyncExternalStore } from "react";
import { IconChevronDown } from "@/components/icons/StrokeIcons";
import { Button } from "@/components/ui/Button";
import { dailyZdProposalAnchorId } from "@/components/summary/DailyZdProposals";
import { cn } from "@/lib/cn";
import { polishPluralWord } from "@/lib/email/polish-plural";
import {
  ZD_AUTOMAT_NIGHT_RUN_TIME,
  buildZdAutomatDailyStatus,
  daysBetweenKeys,
  formatAutomatDay,
  warsawKeyFromIso,
  zdAutomatCycles,
  zdAutomatLastResultLabel,
  zdAutomatNightPassed,
  zdAutomatNightRunState,
  zdAutomatSupplierView,
  type ZdAutomatDailyData,
  type ZdAutomatDailyProposal,
  type ZdAutomatDailySupplier,
  type ZdAutomatSupplierView,
} from "@/lib/orders/zd-automat-daily";
import { panelSubsectionInsetClass } from "@/lib/ui/ontime-theme";

const OPEN_KEY = "ontime:daily-automat-open";

/** Zapamiętane rozwinięcie (per przeglądarka); bez pamięci przeglądarki — zwinięta. */
function readStoredOpen(): boolean {
  try {
    return window.localStorage.getItem(OPEN_KEY) === "1";
  } catch {
    return false;
  }
}
const subscribeStorage = (cb: () => void) => {
  window.addEventListener("storage", cb);
  return () => window.removeEventListener("storage", cb);
};

const zl = (v: number) => `${Math.round(v).toLocaleString("pl-PL")} zł`;

/** Kolor kreski cyklu — stan znaczy: zatwierdzona (zielony), wygasła bez decyzji (bursztyn), czeka (obrys). */
function cycleClass(p: ZdAutomatDailyProposal): string {
  switch (p.status) {
    case "accepted":
      return "bg-emerald-600";
    case "expired":
      return "bg-amber-400";
    case "pending":
      return "border-[1.5px] border-dashed border-amber-600 bg-white";
    default:
      return "bg-slate-300";
  }
}

const CYCLE_TEXT: Record<ZdAutomatDailyProposal["status"], string> = {
  accepted: "zatwierdzona",
  expired: "wygasła bez decyzji",
  pending: "czeka na decyzję",
  rejected: "odrzucona",
  deferred: "odłożona",
};

function CycleStrip({ proposals, todayKey }: { proposals: readonly ZdAutomatDailyProposal[]; todayKey: string }) {
  const cycles = zdAutomatCycles(proposals);
  if (!cycles.length) return <span className="text-xs text-slate-500">brak cykli</span>;
  // Od najstarszego do najnowszego — najnowsza kreska z prawej, przy kolumnie „Następna”.
  const ordered = [...cycles].reverse();
  const label = ordered
    .map((p) => `${formatAutomatDay(warsawKeyFromIso(p.createdAt), todayKey)}: ${CYCLE_TEXT[p.status]}`)
    .join(", ");
  return (
    <span className="flex h-5 items-end gap-[3px]" role="img" aria-label={`Ostatnie cykle: ${label}`}>
      {ordered.map((p) => (
        <span
          key={p.id}
          title={`${formatAutomatDay(warsawKeyFromIso(p.createdAt), todayKey)} · ${CYCLE_TEXT[p.status]}`}
          className={cn("h-5 w-2 rounded-[2px]", cycleClass(p))}
        />
      ))}
    </span>
  );
}

function lastBadgeClass(p: ZdAutomatDailyProposal | undefined): string {
  if (!p) return "bg-slate-100 text-slate-600";
  if (p.status === "pending" || p.status === "expired") return "bg-amber-50 text-amber-900";
  if (p.status === "accepted") return "bg-emerald-50 text-emerald-800";
  return "bg-slate-100 text-slate-700";
}

function nextText(view: ZdAutomatSupplierView, todayKey: string): { main: string; sub: string } | null {
  if (!view.nextKey) return null;
  const days = daysBetweenKeys(todayKey, view.nextKey);
  return {
    main: `${formatAutomatDay(view.nextKey, todayKey)}${days <= 1 ? ` ${ZD_AUTOMAT_NIGHT_RUN_TIME}` : ""}`,
    sub: days > 1 ? `za ${days} ${polishPluralWord(days, "dzień", "dni", "dni")}, gdy jest co zamówić` : "gdy jest co zamówić",
  };
}

function SupplierRow({
  s,
  view,
  todayKey,
  highlighted,
  cardsHref,
}: {
  s: ZdAutomatDailySupplier;
  view: ZdAutomatSupplierView;
  todayKey: string;
  highlighted: boolean;
  /** Karty dostawców — ustawienia automatu są w karcie (`?karta=<id>`), jak z pulpitu automatu. */
  cardsHref: string;
}) {
  const last = s.proposals[0];
  const next = nextText(view, todayKey);
  const problem = view.stopReason ?? view.attemptProblem;
  const cycle = s.cycleDays ? `co ${s.cycleDays} ${polishPluralWord(s.cycleDays, "dzień", "dni", "dni")}` : "bez cyklu";
  return (
    <li
      id={`automat-zd-${s.id}`}
      className={cn(
        "grid grid-cols-1 gap-x-3 gap-y-2 px-3 py-3 sm:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_minmax(0,1fr)_5.5rem_10rem] sm:items-center sm:px-4 lg:px-5",
        problem ? "bg-amber-50/70" : null,
        highlighted && "ring-2 ring-inset ring-indigo-300"
      )}
    >
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold text-slate-900">{s.name}</p>
        <p className="text-xs text-slate-600">{cycle}</p>
        {s.levelRollback ? (
          <p className="text-xs text-amber-800" title={s.levelRollback.reason}>
            stopień obniżony {formatAutomatDay(warsawKeyFromIso(s.levelRollback.at), todayKey)} (braki A)
          </p>
        ) : null}
      </div>

      {problem ? (
        <div className="min-w-0 sm:col-span-2">
          <p className="text-sm font-medium text-amber-900">{view.stopReason ? "Automat stoi" : "Dziś bez propozycji"}</p>
          <p className="text-xs text-amber-800">{problem}</p>
        </div>
      ) : (
        <>
          <div className="min-w-0">
            {/* Na telefonie bez nagłówka kolumn — podpis przy wartości; od sm tylko dla czytnika. */}
            <span className="block text-xs text-slate-500 sm:sr-only">Ostatnio</span>
            <span className={cn("inline-flex max-w-full rounded-md px-1.5 py-0.5 text-xs font-medium tabular-nums", lastBadgeClass(last))}>
              <span className="truncate">{zdAutomatLastResultLabel(last, todayKey)}</span>
            </span>
            {last ? (
              <p className="mt-0.5 text-xs tabular-nums text-slate-600">
                <span className="whitespace-nowrap">
                  {last.lineCount} {polishPluralWord(last.lineCount, "pozycja", "pozycje", "pozycji")}
                </span>{" "}
                · <span className="whitespace-nowrap">ok. {zl(last.valueNet)}</span>
              </p>
            ) : null}
          </div>
          <div className="min-w-0">
            <span className="block text-xs text-slate-500 sm:sr-only">Następna propozycja</span>
            {next ? (
              <>
                <p className="text-sm font-medium tabular-nums text-slate-900">{next.main}</p>
                <p className="text-xs text-slate-600">{next.sub}</p>
              </>
            ) : (
              <p className="text-sm text-slate-600">nie zaplanowana</p>
            )}
          </div>
        </>
      )}

      <div className="flex items-center justify-between gap-2 sm:contents">
        <CycleStrip proposals={s.proposals} todayKey={todayKey} />
        <span className="flex gap-1 sm:justify-end">
          <Link
            href={`${cardsHref}?karta=${encodeURIComponent(s.id)}`}
            className="inline-flex min-h-11 items-center rounded-md px-2.5 text-xs font-medium text-slate-600 transition-colors duration-150 hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 sm:min-h-8"
          >
            Ustawienia
          </Link>
        </span>
      </div>
    </li>
  );
}

/**
 * Panel dzienny → „Dziś”: automat ZD jako jedna linia stanu (czeka propozycja, automat stoi, nocny przebieg).
 * Decyzja o propozycji zapada tylko w wierszu dostawcy w kolejce („Sprawdź i zatwierdź”) — tu „Pokaż w kolejce”
 * przewija do tego wiersza. „Dostawcy (N)” rozwija stan automatu u każdego dostawcy; ustawienia są w karcie dostawcy.
 */
export function DailyZdAutomatSection({
  data,
  nowIso,
  cardsHref,
}: {
  data: ZdAutomatDailyData;
  /** Czas z serwera — ten sam wynik przy renderze na serwerze i w przeglądarce. */
  nowIso: string;
  /** Karty dostawców (link „Ustawienia” → karta dostawcy z sekcją Automat ZD). */
  cardsHref: string;
}) {
  const titleId = useId();
  const listId = useId();
  const storedOpen = useSyncExternalStore(subscribeStorage, readStoredOpen, () => false);
  const [openOverride, setOpenOverride] = useState<boolean | null>(null);
  const open = openOverride ?? storedOpen;
  const [highlight, setHighlight] = useState<string | null>(null);

  const toggle = (next: boolean) => {
    setOpenOverride(next);
    try {
      window.localStorage.setItem(OPEN_KEY, next ? "1" : "0");
    } catch {
      // bez zapamiętania
    }
  };

  const { todayKey, nowMinutes } = useMemo(() => {
    const parts = new Intl.DateTimeFormat("en-GB", {
      timeZone: "Europe/Warsaw",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    }).formatToParts(new Date(nowIso));
    const h = Number(parts.find((p) => p.type === "hour")?.value ?? 0);
    const m = Number(parts.find((p) => p.type === "minute")?.value ?? 0);
    return { todayKey: warsawKeyFromIso(nowIso), nowMinutes: h * 60 + m };
  }, [nowIso]);

  const status = buildZdAutomatDailyStatus(data, { todayKey, nowMinutes });
  const night = zdAutomatNightRunState(data.run, todayKey, nowMinutes);
  const nightPassed = zdAutomatNightPassed(night);
  const rank = (v: ZdAutomatSupplierView) => (v.pending ? 0 : v.stopReason || v.attemptProblem ? 1 : 2);
  const rows = data.suppliers
      .map((s) => ({ s, view: zdAutomatSupplierView(s, { todayKey, nightPassed }) }))
      .sort(
        (a, b) =>
          rank(a.view) - rank(b.view) ||
          (a.view.nextKey ?? "9999").localeCompare(b.view.nextKey ?? "9999") ||
          a.s.name.localeCompare(b.s.name, "pl")
      );

  if (!status) return null;

  const smooth = (): ScrollBehavior =>
    window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth";
  const reveal = (supplierId: string) => {
    toggle(true);
    setHighlight(supplierId);
    requestAnimationFrame(() =>
      document.getElementById(`automat-zd-${supplierId}`)?.scrollIntoView({ block: "nearest", behavior: smooth() })
    );
  };
  /** Przewija do bloku propozycji w wierszu dostawcy i na chwilę go obrysowuje; bez wiersza — pokazuje dostawcę na liście. */
  const showInQueue = (supplierId: string) => {
    const el = document.getElementById(dailyZdProposalAnchorId(supplierId));
    if (!el) return reveal(supplierId);
    el.scrollIntoView({ block: "center", behavior: smooth() });
    el.classList.add("ring-2", "ring-indigo-300");
    window.setTimeout(() => el.classList.remove("ring-2", "ring-indigo-300"), 2000);
    el.querySelector<HTMLButtonElement>("button:last-of-type")?.focus({ preventScroll: true });
  };
  const warning = status.tone === "warning";
  // Czekająca propozycja: w linii tylko termin wygaśnięcia i stan nocnego przebiegu — szczegóły są w wierszu kolejki.
  // Niepotwierdzone tworzenie ZD i pozostałe stany zostają z pełnym opisem (tylko tu je widać).
  const firstPending = rows.find((r) => r.view.pending)?.view;
  const detail =
    status.action?.kind === "review" && firstPending && !firstPending.pending!.createAttemptedAt
      ? [
          firstPending.nextKey ? `wygasa ${formatAutomatDay(firstPending.nextKey, todayKey)}` : null,
          night.kind === "missing"
            ? `dziś bez nocnego przebiegu${night.lastRunDate ? ` (ostatni ${formatAutomatDay(night.lastRunDate, todayKey)})` : ""}`
            : night.kind === "done" && night.failed
              ? "nocny przebieg z błędem"
              : null,
        ]
          .filter(Boolean)
          .join(" · ")
      : status.detail;

  return (
    <section
      aria-labelledby={titleId}
      className={cn(
        "overflow-hidden rounded-[var(--radius-panel)] border shadow-[var(--shadow-card)]",
        warning ? "border-amber-200 bg-amber-50" : "border-slate-200 bg-[var(--card)]"
      )}
    >
      <div className={cn("flex flex-col gap-2 py-2.5 sm:flex-row sm:items-center sm:justify-between sm:gap-4", panelSubsectionInsetClass)}>
        <p role="status" className={cn("min-w-0 text-sm leading-snug", warning ? "text-amber-900" : "text-slate-600")}>
          <span id={titleId} className={cn("font-semibold", warning ? "text-amber-950" : "text-slate-900")}>
            {status.headline}
          </span>
          {detail ? <> · {detail}</> : null}
        </p>
        <div className="flex shrink-0 items-center gap-1.5 self-end sm:self-auto">
          {status.action ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="min-h-11 sm:min-h-8"
              onClick={() =>
                status.action!.kind === "review" ? showInQueue(status.action!.supplierId) : reveal(status.action!.supplierId)
              }
            >
              {status.action.kind === "review" ? "Pokaż w kolejce" : status.action.label}
            </Button>
          ) : null}
          <button
            type="button"
            aria-expanded={open}
            aria-controls={listId}
            onClick={() => toggle(!open)}
            className="inline-flex min-h-11 items-center gap-1 rounded-md px-2 text-xs font-medium text-slate-600 transition-colors duration-150 hover:bg-slate-900/5 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 sm:min-h-8"
          >
            {open ? "Zwiń" : `Dostawcy (${data.suppliers.length})`}
            <IconChevronDown
              size={14}
              aria-hidden
              className={cn("transition-transform duration-200 motion-reduce:transition-none", open && "rotate-180")}
            />
          </button>
        </div>
      </div>

      {open ? (
        <div id={listId} className="zd-automat-detail-enter border-t border-slate-200 bg-[var(--card)]">
          <div
            aria-hidden
            className={cn(
              "hidden gap-x-3 bg-slate-50 py-1.5 text-xs font-medium text-slate-500 sm:grid sm:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_minmax(0,1fr)_5.5rem_10rem]",
              panelSubsectionInsetClass
            )}
          >
            <span>Dostawca</span>
            <span>Ostatnio</span>
            <span>Następna</span>
            <span>Ostatnie cykle</span>
            <span />
          </div>
          <ul className="divide-y divide-slate-100">
            {rows.map(({ s, view }) => (
              <SupplierRow
                key={s.id}
                s={s}
                view={view}
                todayKey={todayKey}
                highlighted={highlight === s.id}
                cardsHref={cardsHref}
              />
            ))}
          </ul>
          <div
            className={cn(
              "flex flex-wrap items-center gap-x-4 gap-y-1.5 border-t border-slate-100 py-2 text-xs text-slate-600",
              panelSubsectionInsetClass
            )}
          >
            <span className="inline-flex items-center gap-1.5">
              <span aria-hidden className="h-2.5 w-2 rounded-[2px] bg-emerald-600" /> zatwierdzona
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span aria-hidden className="h-2.5 w-2 rounded-[2px] bg-amber-400" /> wygasła bez decyzji
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span aria-hidden className="h-2.5 w-2 rounded-[2px] bg-slate-300" /> odrzucona lub odłożona
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span aria-hidden className="h-2.5 w-2 rounded-[2px] border-[1.5px] border-dashed border-amber-600 bg-white" /> czeka
            </span>
            <Link href="/zakupy/automat" className="ml-auto font-medium text-indigo-700 underline-offset-2 hover:underline">
              Pulpit automatu
            </Link>
          </div>
        </div>
      ) : null}
    </section>
  );
}
