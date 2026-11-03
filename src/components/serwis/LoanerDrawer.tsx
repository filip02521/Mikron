"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/cn";
import { polishPluralWord } from "@/lib/email/polish-plural";
import { SCROLL_LOCK_ALLOW_ATTR, useBodyScrollLock } from "@/lib/ui/page-scroll-lock";
import {
  actionEndLoanerService,
  actionExtendLoaner,
  actionReturnLoaner,
  actionStartLoanerService,
} from "@/app/actions/service-loaners";
import {
  addDays,
  daysBetween,
  LOANER_CONDITIONS,
  loanerStats,
  parseDateOnly,
  toDateOnly,
  type LoanerEvent,
} from "@/lib/orders/service-loaners";
import { formatLong, formatShort, StatePill, type LoanerUnitView } from "@/components/serwis/LoanersBoard";

const EVENT_DOT: Record<LoanerEvent["type"], string> = {
  created: "border-slate-300",
  issued: "border-indigo-600",
  returned: "border-emerald-500",
  extended: "border-indigo-300",
  service_start: "border-amber-500",
  service_end: "border-emerald-500",
  retired: "border-slate-400",
};

function eventTitle(e: LoanerEvent): string {
  switch (e.type) {
    case "created":
      return "Dodany do puli zamienników";
    case "issued":
      return `Wydany: ${e.clientName ?? "-"}`;
    case "returned":
      return `Zwrot od: ${e.clientName ?? "-"}`;
    case "extended":
      return "Przedłużono termin zwrotu";
    case "service_start":
      return "Przegląd";
    case "service_end":
      return "Przegląd zakończony";
    case "retired":
      return "Wycofany";
  }
}

function eventMeta(e: LoanerEvent, unit: LoanerUnitView): string {
  const parts: string[] = [];
  if (e.type === "returned") {
    const stint = unit.stints.find((s) => s.to === e.at);
    if (stint) parts.push(`po ${daysBetween(stint.from, stint.to!)} dniach`);
  }
  if (e.plannedReturn && (e.type === "issued" || e.type === "extended")) {
    parts.push(`zwrot do ${formatShort(parseDateOnly(e.plannedReturn).toISOString())}`);
  }
  if (e.condition && (e.type === "returned" || e.type === "service_end" || e.type === "created")) parts.push(`stan: ${e.condition}`);
  if (e.note) parts.push(e.note);
  if (e.actorName) parts.push(e.actorName);
  return parts.join(" · ");
}

function DaysRing({ days, planned }: { days: number; planned: number | null }) {
  const total = Math.max(planned ?? days, 1);
  const frac = Math.min(days / total, 1);
  const r = 36;
  const c = 2 * Math.PI * r;
  const tone = planned != null && days > planned ? "text-red-500" : days > 14 ? "text-amber-500" : "text-indigo-600";
  return (
    <svg viewBox="0 0 84 84" className="h-[84px] w-[84px] flex-none" aria-hidden>
      <circle cx="42" cy="42" r={r} fill="none" className="stroke-slate-200" strokeWidth="7" />
      <circle
        cx="42"
        cy="42"
        r={r}
        fill="none"
        stroke="currentColor"
        className={tone}
        strokeWidth="7"
        strokeLinecap="round"
        strokeDasharray={`${c * frac} ${c}`}
        transform="rotate(-90 42 42)"
      />
      <text x="42" y="46" textAnchor="middle" className="fill-slate-900 font-display text-[22px] font-bold">
        {days}
      </text>
      <text x="42" y="60" textAnchor="middle" className="fill-slate-500 text-[9.5px]">
        {polishPluralWord(days, "dzień", "dni", "dni")}
      </text>
    </svg>
  );
}

type Mode = null | "return" | "extend" | "service_end";

export function LoanerDrawer({
  unit,
  today,
  onClose,
  onIssue,
  onDone,
}: {
  unit: LoanerUnitView;
  today: Date;
  onClose: () => void;
  onIssue: () => void;
  onDone: (message: string) => void;
}) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const [mode, setMode] = useState<Mode>(null);
  const [cond, setCond] = useState(unit.condition);
  const [needsService, setNeedsService] = useState(false);
  const [note, setNote] = useState("");
  const [extendTo, setExtendTo] = useState(() =>
    toDateOnly(addDays(unit.plannedReturn && parseDateOnly(unit.plannedReturn) > today ? parseDateOnly(unit.plannedReturn) : today, 7))
  );
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  useBodyScrollLock(true);

  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if ((e.target as HTMLElement | null)?.closest('[role="dialog"]:not([data-loaner-drawer])')) return;
      onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      prev?.focus?.();
    };
  }, [onClose]);

  const stats = loanerStats(unit, unit.stints, today);
  const planned = unit.currentSince && unit.plannedReturn ? daysBetween(unit.currentSince, parseDateOnly(unit.plannedReturn)) : null;
  const events = [...unit.events].sort((a, b) => b.at.localeCompare(a.at) || b.id - a.id);

  const submit = (fn: () => Promise<{ ok: boolean; message: string }>) => {
    setError(null);
    start(async () => {
      const res = await fn();
      if (!res.ok) {
        setError(res.message);
        return;
      }
      onDone(res.message);
      onClose();
    });
  };

  const copyPhone = () => {
    const phone = unit.currentClientPhone ?? "";
    navigator.clipboard?.writeText(phone).then(
      () => onDone(`Skopiowano ${phone}`),
      () => onDone(`Telefon: ${phone}`)
    );
  };

  return (
    <>
      <div className="fixed inset-0 z-[58] bg-scrim/40" onClick={onClose} aria-hidden />
      <aside
        role="dialog"
        aria-modal="true"
        aria-labelledby="loaner-drawer-title"
        data-loaner-drawer
        className="fixed inset-y-0 right-0 z-[60] flex w-full max-w-[29rem] flex-col border-l border-slate-200 bg-raised shadow-2xl"
        style={{ paddingTop: "env(safe-area-inset-top,0px)", paddingBottom: "env(safe-area-inset-bottom,0px)" }}
      >
        <div className="flex flex-col gap-2.5 border-b border-slate-100 px-6 pb-4 pt-5">
          <div className="flex items-center gap-2">
            <span className="font-mono text-[13px] font-semibold text-slate-500">
              {unit.code}
              {unit.serialNo && !unit.code.includes(unit.serialNo) ? ` · SN ${unit.serialNo}` : ""}
            </span>
            <StatePill state={unit.state} />
            <button
              ref={closeRef}
              type="button"
              onClick={onClose}
              aria-label="Zamknij"
              className="ml-auto grid h-9 w-9 place-items-center rounded-lg text-slate-500 transition-colors duration-150 hover:bg-slate-100 hover:text-slate-900"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
                <path d="M6 6l12 12M18 6L6 18" />
              </svg>
            </button>
          </div>
          <h2 id="loaner-drawer-title" className="font-display text-xl font-bold leading-tight tracking-tight text-slate-900">
            {unit.twName}
          </h2>
          <span className="text-[13px] text-slate-500">
            Towar w Subiekcie: <span className="font-mono">{unit.twSymbol ?? "-"}</span> · stan techniczny: {unit.condition}
          </span>
        </div>

        <div className="flex-1 space-y-5 overflow-y-auto px-6 py-5" {...{ [SCROLL_LOCK_ALLOW_ATTR]: "" }}>
          {unit.status === "u_klienta" && unit.currentSince ? (
            <>
              <div className="flex items-center gap-4 rounded-xl border border-slate-200 p-4">
                <DaysRing days={unit.daysOut ?? 0} planned={planned} />
                <div className="flex min-w-0 flex-col gap-1">
                  <span className="text-[15px] font-semibold text-slate-900">{unit.currentClientName}</span>
                  <span className="text-[13px] text-slate-500">
                    od {formatLong(unit.currentSince)}
                    {unit.plannedReturn ? (
                      unit.state === "late" ? (
                        <b className="font-semibold text-red-700"> · zwrot minął {formatShort(parseDateOnly(unit.plannedReturn).toISOString())}</b>
                      ) : (
                        ` · zwrot ${formatShort(parseDateOnly(unit.plannedReturn).toISOString())}`
                      )
                    ) : null}
                  </span>
                  {unit.currentClientPhone ? <span className="font-mono text-[13px] text-slate-600">tel. {unit.currentClientPhone}</span> : null}
                </div>
              </div>
              {mode === null ? (
                <div className="flex flex-wrap gap-2">
                  <Button type="button" size="sm" onClick={() => setMode("return")}>
                    Przyjmij zwrot
                  </Button>
                  <Button type="button" size="sm" variant="secondary" onClick={() => setMode("extend")}>
                    Przedłuż
                  </Button>
                  {unit.currentClientPhone ? (
                    <Button type="button" size="sm" variant="secondary" onClick={copyPhone}>
                      Kopiuj telefon
                    </Button>
                  ) : null}
                </div>
              ) : null}
            </>
          ) : (
            <>
              <div className="rounded-xl border border-slate-200 p-4">
                <div className="text-[15px] font-semibold text-slate-900">
                  {unit.state === "svc" ? "W przeglądzie u serwisu" : "Na półce, gotowy do wydania"}
                </div>
                <div className="text-[13px] text-slate-500">
                  {unit.state === "svc"
                    ? "Wraca na stan po zakończeniu przeglądu."
                    : unit.stints.length
                      ? `Ostatni zwrot: ${formatLong(unit.stints[unit.stints.length - 1]!.to ?? unit.createdAt)}`
                      : "Jeszcze nie był wydany."}
                </div>
              </div>
              {mode === null ? (
                <div className="flex flex-wrap gap-2">
                  {unit.state === "free" ? (
                    <>
                      <Button type="button" size="sm" onClick={onIssue}>
                        Wydaj ten egzemplarz
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="secondary"
                        disabled={pending}
                        onClick={() => submit(() => actionStartLoanerService({ unitId: unit.id }))}
                      >
                        Oznacz do przeglądu
                      </Button>
                    </>
                  ) : (
                    <Button type="button" size="sm" onClick={() => setMode("service_end")}>
                      Zakończ przegląd
                    </Button>
                  )}
                </div>
              ) : null}
            </>
          )}

          {mode === "return" || mode === "service_end" ? (
            <form
              className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-4"
              onSubmit={(e) => {
                e.preventDefault();
                submit(() =>
                  mode === "return"
                    ? actionReturnLoaner({ unitId: unit.id, condition: cond, needsService, note })
                    : actionEndLoanerService({ unitId: unit.id, condition: cond, note })
                );
              }}
            >
              <div className="text-sm font-semibold text-slate-900">{mode === "return" ? "Przyjęcie zwrotu" : "Koniec przeglądu"}</div>
              <div role="group" aria-label="Stan techniczny" className="flex flex-wrap gap-1.5">
                {LOANER_CONDITIONS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    aria-pressed={cond === c}
                    onClick={() => {
                      setCond(c);
                      if (mode === "return") setNeedsService(c === "do przeglądu" || c === "uszkodzony");
                    }}
                    className={cn(
                      "h-8 rounded-full border px-3 text-[13px] transition-colors duration-150",
                      cond === c ? "border-indigo-600 bg-indigo-50 font-semibold text-indigo-900" : "border-slate-200 bg-card text-slate-600 hover:bg-slate-100"
                    )}
                  >
                    {c}
                  </button>
                ))}
              </div>
              {mode === "return" ? (
                <label className="flex items-center gap-2 text-sm text-slate-700">
                  <input id="loaner-needs-service" type="checkbox" checked={needsService} onChange={(e) => setNeedsService(e.target.checked)} className="h-4 w-4 accent-[var(--primary)]" />
                  Wymaga przeglądu przed kolejnym wydaniem
                </label>
              ) : null}
              <input
                id="loaner-note"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                maxLength={300}
                placeholder="Uwagi (opcjonalnie), np. brak kabla"
                className="h-10 w-full rounded-lg border border-slate-200 bg-card px-3 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
              />
              {error ? <p className="text-sm text-red-700">{error}</p> : null}
              <div className="flex justify-end gap-2">
                <Button type="button" size="sm" variant="secondary" onClick={() => setMode(null)} disabled={pending}>
                  Anuluj
                </Button>
                <Button type="submit" size="sm" disabled={pending}>
                  {pending ? "Zapisuję…" : mode === "return" ? "Przyjmij zwrot" : "Zakończ przegląd"}
                </Button>
              </div>
            </form>
          ) : null}

          {mode === "extend" ? (
            <form
              className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-4"
              onSubmit={(e) => {
                e.preventDefault();
                submit(() => actionExtendLoaner({ unitId: unit.id, plannedReturn: extendTo }));
              }}
            >
              <label htmlFor="loaner-extend" className="block text-sm font-semibold text-slate-900">
                Nowy termin zwrotu
              </label>
              <input
                id="loaner-extend"
                type="date"
                value={extendTo}
                min={toDateOnly(today)}
                onChange={(e) => setExtendTo(e.target.value)}
                className="h-10 w-full rounded-lg border border-slate-200 bg-card px-3 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
              />
              {error ? <p className="text-sm text-red-700">{error}</p> : null}
              <div className="flex justify-end gap-2">
                <Button type="button" size="sm" variant="secondary" onClick={() => setMode(null)} disabled={pending}>
                  Anuluj
                </Button>
                <Button type="submit" size="sm" disabled={pending}>
                  {pending ? "Zapisuję…" : "Zapisz termin"}
                </Button>
              </div>
            </form>
          ) : null}

          {error && mode === null ? <p className="text-sm text-red-700">{error}</p> : null}

          <div className="grid grid-cols-3 gap-2">
            <div className="rounded-lg bg-slate-50 px-3 py-2.5">
              <b className="block font-display text-lg font-bold tabular-nums">{stats.issues}</b>
              <span className="text-xs text-slate-500">{polishPluralWord(stats.issues, "wydanie", "wydania", "wydań")}</span>
            </div>
            <div className="rounded-lg bg-slate-50 px-3 py-2.5">
              <b className="block font-display text-lg font-bold tabular-nums">{stats.avgDaysOut}</b>
              <span className="text-xs text-slate-500">śr. dni u klienta</span>
            </div>
            <div className="rounded-lg bg-slate-50 px-3 py-2.5">
              <b className="block font-display text-lg font-bold tabular-nums">{stats.utilizationPct}%</b>
              <span className="text-xs text-slate-500">czasu u klientów</span>
            </div>
          </div>

          <div>
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">Historia egzemplarza</p>
            <ol className="relative space-y-4 pl-5 before:absolute before:bottom-1.5 before:left-[5px] before:top-1.5 before:w-px before:bg-slate-200">
              {events.map((e) => (
                <li key={e.id} className="relative">
                  <span className={cn("absolute -left-5 top-1 h-[11px] w-[11px] rounded-full border-2 bg-raised", EVENT_DOT[e.type])} aria-hidden />
                  <div className="text-xs tabular-nums text-slate-400">{formatLong(e.at)}</div>
                  <div className="font-semibold text-slate-900">{eventTitle(e)}</div>
                  {eventMeta(e, unit) ? <div className="text-[13px] text-slate-500">{eventMeta(e, unit)}</div> : null}
                </li>
              ))}
            </ol>
          </div>
        </div>
      </aside>
    </>
  );
}
