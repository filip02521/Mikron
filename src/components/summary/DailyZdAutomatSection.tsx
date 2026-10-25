"use client";

import Link from "next/link";
import { useId, useMemo, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { IconChevronDown, IconClock } from "@/components/icons/StrokeIcons";
import { Button } from "@/components/ui/Button";
import { dailyPanelQueueShellClass } from "@/components/summary/DailyPanelSubsectionBar";
import { useDailyZdProposalMap } from "@/components/summary/DailyZdProposals";
import { ZdAutoProposalSheet } from "@/components/zakupy/ZdAutoProposalSheet";
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
import { panelSubsectionInsetClass, panelTypography } from "@/lib/ui/ontime-theme";

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
  onReview,
  cardsHref,
}: {
  s: ZdAutomatDailySupplier;
  view: ZdAutomatSupplierView;
  todayKey: string;
  highlighted: boolean;
  onReview: (supplierId: string) => void;
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
          {view.pending ? (
            <Button type="button" variant="outline" size="sm" className="min-h-10 sm:min-h-8" onClick={() => onReview(s.id)}>
              Sprawdź
            </Button>
          ) : null}
          <Link
            href={`${cardsHref}?karta=${encodeURIComponent(s.id)}`}
            className="inline-flex min-h-10 items-center rounded-md px-2.5 text-xs font-medium text-slate-600 transition-colors duration-150 hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 sm:min-h-8"
          >
            Ustawienia
          </Link>
        </span>
      </div>
    </li>
  );
}

/**
 * Panel dzienny → „Dziś”: automat ZD w jednym miejscu — zdanie stanu (czeka propozycja, automat stoi, nocny przebieg),
 * a po rozwinięciu dostawcy z ostatnim wynikiem, następną propozycją i ostatnimi cyklami. Tylko stan: ustawienia są
 * w karcie dostawcy (to samo okno), a propozycję zatwierdza ten sam panel co w wierszu harmonogramu.
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
  const router = useRouter();
  const titleId = useId();
  const listId = useId();
  const storedOpen = useSyncExternalStore(subscribeStorage, readStoredOpen, () => false);
  const [openOverride, setOpenOverride] = useState<boolean | null>(null);
  const open = openOverride ?? storedOpen;
  const [highlight, setHighlight] = useState<string | null>(null);
  const [reviewId, setReviewId] = useState<string | null>(null);
  const proposals = useDailyZdProposalMap();
  const reviewProposal = reviewId ? (proposals.get(reviewId) ?? null) : null;

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
  const nightPassed = zdAutomatNightPassed(zdAutomatNightRunState(data.run, todayKey, nowMinutes));
  const rows = useMemo(() => {
    const ctx = { todayKey, nightPassed };
    const rank = (v: ZdAutomatSupplierView) => (v.pending ? 0 : v.stopReason || v.attemptProblem ? 1 : 2);
    return data.suppliers
      .map((s) => ({ s, view: zdAutomatSupplierView(s, ctx) }))
      .sort(
        (a, b) =>
          rank(a.view) - rank(b.view) ||
          (a.view.nextKey ?? "9999").localeCompare(b.view.nextKey ?? "9999") ||
          a.s.name.localeCompare(b.s.name, "pl")
      );
  }, [data.suppliers, todayKey, nightPassed]);

  if (!status) return null;

  const reveal = (supplierId: string) => {
    toggle(true);
    setHighlight(supplierId);
    requestAnimationFrame(() =>
      document.getElementById(`automat-zd-${supplierId}`)?.scrollIntoView({ block: "nearest", behavior: "smooth" })
    );
  };
  const review = (supplierId: string) => {
    // Propozycja jest w danych panelu (czekające) — ten sam panel boczny co w wierszu harmonogramu.
    // Gdy jej tam nie ma (np. zatwierdzona w innej karcie) — pokaż dostawcę zamiast nic nie robić.
    if (proposals.has(supplierId)) setReviewId(supplierId);
    else reveal(supplierId);
  };
  const warning = status.tone === "warning";

  return (
    <section aria-labelledby={titleId} className={cn(dailyPanelQueueShellClass(), "mb-3")}>
      <div className={cn("flex flex-col gap-3 py-3 sm:flex-row sm:items-start sm:justify-between", panelSubsectionInsetClass)}>
        <div className="flex min-w-0 items-start gap-2.5">
          <span
            aria-hidden
            className={cn(
              "mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-md ring-1",
              warning ? "bg-amber-50 text-amber-800 ring-amber-200" : "bg-indigo-50 text-indigo-700 ring-indigo-100"
            )}
          >
            <IconClock size={16} />
          </span>
          <div className="min-w-0" role="status">
            <h3 id={titleId} className={cn(panelTypography.sectionTitle, warning && "text-amber-950")}>
              {status.headline}
            </h3>
            <p className={cn("mt-0.5", panelTypography.caption, warning && "text-amber-900")}>{status.detail}</p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1.5 self-end sm:self-start">
          {status.action ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="min-h-10 sm:min-h-8"
              onClick={() => (status.action!.kind === "review" ? review(status.action!.supplierId) : reveal(status.action!.supplierId))}
            >
              {status.action.label}
            </Button>
          ) : null}
          <button
            type="button"
            aria-expanded={open}
            aria-controls={listId}
            onClick={() => toggle(!open)}
            className="inline-flex min-h-10 items-center gap-1 rounded-md px-2 text-xs font-medium text-slate-600 transition-colors duration-150 hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 sm:min-h-8"
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
        <div id={listId} className="zd-automat-detail-enter border-t border-slate-100">
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
                onReview={review}
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

      {reviewId && reviewProposal ? (
        <ZdAutoProposalSheet
          supplierId={reviewProposal.supplierId}
          supplierName={reviewProposal.supplierName}
          morning={reviewProposal}
          onClose={() => {
            setReviewId(null);
            router.refresh();
          }}
        />
      ) : null}
    </section>
  );
}
