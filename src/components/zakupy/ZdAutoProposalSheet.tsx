"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { actionAcceptZdAutoProposal, actionCreateZdAutoProposalNow } from "@/app/actions/zd-estimate";
import { IconAlertCircle, IconCheck, IconCircleCheck, IconTrash2, IconUndoLeft, IconX } from "@/components/icons/StrokeIcons";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { FOCUSABLE_SELECTOR } from "@/components/ui/ModalShell";
import { QtyStepButton } from "@/components/ui/QtyStepButton";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { Spinner } from "@/components/ui/Spinner";
import { BrandLoader } from "@/components/ui/BrandLoader";
import { ZdEstimatePostCreatePanel } from "@/components/zakupy/ZdEstimatePostCreatePanel";
import { cn } from "@/lib/cn";
import type { ZdAutoProposal, ZdAutoProposalLine } from "@/lib/data/zd-auto-proposals";
import { polishPluralWord } from "@/lib/email/polish-plural";
import { ZD_AUTO_PROPOSAL_EDIT_MAX_UNITS, diffZdAutoProposalLines } from "@/lib/orders/zd-auto-proposal-create";
import type { ZdPostCreateSession } from "@/lib/orders/zd-estimate-post-create";
import { formatQty } from "@/lib/orders/zd-estimate-manual";
import { SCROLL_LOCK_ALLOW_ATTR, useBodyScrollLock } from "@/lib/ui/page-scroll-lock";
import {
  sidePanelBackdropClass,
  sidePanelCloseButtonClass,
  sidePanelHeaderClass,
  sidePanelShellClass,
} from "@/lib/ui/surfaces";
import { useAnimatedClose } from "@/lib/ui/use-animated-close";

type Phase = "review" | "creating" | "send";
type Filter = "all" | "changes" | "edited";

const zl = (v: number) => `${Math.round(v).toLocaleString("pl-PL")} zł`;

function formatWhen(iso: string): string {
  return new Date(iso).toLocaleString("pl-PL", {
    timeZone: "Europe/Warsaw",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

const PHASES: Array<{ key: Phase; label: string }> = [
  { key: "review", label: "Sprawdź i popraw" },
  { key: "creating", label: "ZD w Subiekcie" },
  { key: "send", label: "Wysyłka i plan" },
];

/** Trzy odcinki postępu pod nagłówkiem — gdzie jesteś i co jeszcze przed Tobą. */
function PhaseProgress({ phase }: { phase: Phase }) {
  const at = PHASES.findIndex((p) => p.key === phase);
  return (
    <ol className="mt-4 grid grid-cols-3 gap-2" aria-label="Etapy">
      {PHASES.map((p, i) => (
        <li key={p.key} aria-current={i === at ? "step" : undefined} className="min-w-0">
          <span
            aria-hidden
            className={cn(
              "block h-1 rounded-full transition-colors duration-300 motion-reduce:transition-none",
              i < at ? "bg-indigo-600" : i === at ? "bg-indigo-400" : "bg-slate-200"
            )}
          />
          <span className={cn("mt-1.5 block truncate text-xs", i <= at ? "font-medium text-slate-900" : "text-slate-500")}>
            {p.label}
          </span>
        </li>
      ))}
    </ol>
  );
}

type StepStatus = "idle" | "running" | "ok" | "error";
type Step = { key: string; title: string; detail: React.ReactNode; status: StepStatus; message?: string; onRetry?: () => void };

/**
 * Pionowa oś działań: węzeł ze stanem, szyna zielenieje po każdym zakończonym kroku.
 * Krok w toku ma animowane logo OnTime (systemowe ładowanie), pod nim pierścień na 250 ms,
 * zanim logo się pojawi — węzeł nigdy nie jest pusty.
 */
function ActionTimeline({ steps }: { steps: Step[] }) {
  return (
    <ol className="relative" aria-label="Działania po zatwierdzeniu">
      {steps.map((s, i) => {
        const last = i === steps.length - 1;
        return (
          <li key={s.key} className="relative flex gap-3 pb-5 last:pb-0" aria-current={s.status === "running" ? "step" : undefined}>
            {!last ? (
              <span
                aria-hidden
                className={cn(
                  "absolute top-9 bottom-1 left-4 w-px -translate-x-1/2 transition-colors duration-300 motion-reduce:transition-none",
                  s.status === "ok" ? "bg-emerald-300" : "bg-slate-200"
                )}
              />
            ) : null}
            <span aria-hidden className="relative z-[1] flex size-8 shrink-0 items-center justify-center">
              {s.status === "running" ? (
                <>
                  <span className="absolute inset-0 rounded-full ring-2 ring-indigo-200" />
                  <BrandLoader size="md" className="relative" />
                </>
              ) : (
                <span
                  className={cn(
                    "flex size-8 items-center justify-center rounded-full text-xs font-semibold tabular-nums transition-colors duration-200 motion-reduce:transition-none",
                    s.status === "ok" && "bg-emerald-600 text-white",
                    s.status === "error" && "bg-red-600 text-white",
                    s.status === "idle" && "bg-white text-slate-500 ring-1 ring-slate-300"
                  )}
                >
                  {s.status === "ok" ? (
                    <IconCheck size={15} strokeWidth={2.5} />
                  ) : s.status === "error" ? (
                    <IconAlertCircle size={15} />
                  ) : (
                    i + 1
                  )}
                </span>
              )}
            </span>
            <div className="min-w-0 flex-1 pt-1">
              <p className={cn("text-sm font-semibold", s.status === "idle" ? "text-slate-600" : "text-slate-900")}>{s.title}</p>
              <div className={cn("mt-0.5 leading-snug", s.status === "idle" ? "text-xs text-slate-500" : "text-sm text-slate-600")}>
                {s.detail}
              </div>
              {s.message ? (
                <p
                  className={cn("mt-1 text-sm", s.status === "error" ? "text-red-700" : "text-slate-700")}
                  role={s.status === "error" ? "alert" : undefined}
                >
                  {s.message}
                </p>
              ) : null}
              {s.onRetry ? (
                <Button type="button" size="sm" variant="secondary" className="mt-2" onClick={s.onRetry}>
                  Spróbuj ponownie
                </Button>
              ) : null}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

/** Ilość w jednostkach ZD: −/+ i pole; 0 przez −, usunięcie osobnym przyciskiem. */
function UnitsStepper({
  line,
  value,
  onChange,
  onStep,
  disabled,
}: {
  line: ZdAutoProposalLine;
  value: number;
  onChange: (next: number) => void;
  /** −1 / +1 liczone od poprzedniego stanu — dwa szybkie kliknięcia to dwa kroki. */
  onStep: (delta: number) => void;
  disabled: boolean;
}) {
  return (
    <div className="flex items-center gap-1">
      <QtyStepButton size="sm" direction="down" label={`Mniej: ${line.nazwa}`} disabled={disabled || value <= 1} onClick={() => onStep(-1)} />
      <input
        type="text"
        inputMode="numeric"
        aria-label={`Ilość (${line.unitLabel}): ${line.nazwa}`}
        value={String(value)}
        disabled={disabled}
        onChange={(e) => {
          const n = Number.parseInt(e.target.value.replace(/\D/g, ""), 10);
          if (Number.isFinite(n) && n >= 1) onChange(Math.min(ZD_AUTO_PROPOSAL_EDIT_MAX_UNITS, n));
        }}
        onFocus={(e) => e.target.select()}
        className="h-10 w-14 rounded-md border border-slate-200 bg-white text-center text-base font-semibold tabular-nums text-slate-900 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 focus:outline-none disabled:bg-slate-50 sm:h-8 sm:w-12 sm:text-sm"
      />
      <QtyStepButton
        size="sm"
        direction="up"
        label={`Więcej: ${line.nazwa}`}
        disabled={disabled || value >= ZD_AUTO_PROPOSAL_EDIT_MAX_UNITS}
        onClick={() => onStep(1)}
      />
    </div>
  );
}

/**
 * Panel dzienny: propozycja ZD automatu w panelu bocznym — sprawdzenie z korektą ilości,
 * utworzenie ZD w Subiekcie i wysyłka (ten sam panel co po „Utwórz ZD” w Kreatorze) w jednym miejscu.
 */
export function ZdAutoProposalSheet({
  supplierId,
  supplierName,
  morning,
  onClose,
}: {
  supplierId: string;
  supplierName: string;
  /** Propozycja, którą widział użytkownik — porównanie po przeliczeniu. */
  morning: ZdAutoProposal;
  onClose: () => void;
}) {
  const router = useRouter();
  const { panelRef, backdropRef, requestClose } = useAnimatedClose(onClose);
  const [phase, setPhase] = useState<Phase>("review");
  const [recompute, setRecompute] = useState<{ status: "running" | "ok" | "error"; message?: string }>({ status: "running" });
  const [fresh, setFresh] = useState<ZdAutoProposal | null>(null);
  const [edits, setEdits] = useState<Record<string, number>>({});
  const [createError, setCreateError] = useState<string | null>(null);
  /** Numer utworzonego ZD — krok „ZD w Subiekcie” chwilę zielony, zanim przejdzie do wysyłki. */
  const [createdNr, setCreatedNr] = useState<string | null>(null);
  const [session, setSession] = useState<ZdPostCreateSession | null>(null);
  const [filter, setFilter] = useState<Filter>("all");
  const started = useRef(false);
  useBodyScrollLock(true);

  const creating = phase === "creating";
  const close = () => {
    if (!creating) requestClose();
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && phase !== "creating") requestClose();
      // Pułapka Tab — panel jest modalny (aria-modal), fokus zostaje w środku.
      if (e.key !== "Tab" || !panelRef.current) return;
      const items = [...panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)].filter((el) => el.offsetParent !== null);
      if (!items.length) return;
      const first = items[0]!, last = items[items.length - 1]!;
      if (e.shiftKey && (document.activeElement === first || !panelRef.current.contains(document.activeElement))) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && (document.activeElement === last || !panelRef.current.contains(document.activeElement))) {
        e.preventDefault();
        first.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [phase, requestClose, panelRef]);

  // Fokus do panelu przy otwarciu, z powrotem na przycisk otwierający po zamknięciu.
  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    panelRef.current?.focus();
    return () => opener?.focus?.();
  }, [panelRef]);

  const runRecompute = () => {
    setRecompute({ status: "running" });
    setFresh(null);
    setEdits({});
    void actionCreateZdAutoProposalNow({ supplierId }).then(
      (r) => {
        if (!r.ok) return setRecompute({ status: "error", message: r.message });
        if (!r.proposal) return setRecompute({ status: "error", message: "Na aktualnych stanach nie ma nic do zamówienia." });
        setFresh(r.proposal);
        setRecompute({ status: "ok" });
      },
      () => setRecompute({ status: "error", message: "Nie udało się przeliczyć propozycji." })
    );
  };
  useEffect(() => {
    // Raz po otwarciu (StrictMode montuje efekt dwa razy).
    if (started.current) return;
    started.current = true;
    runRecompute();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const runCreate = () => {
    if (!fresh) return;
    setCreateError(null);
    setPhase("creating");
    void actionAcceptZdAutoProposal({ supplierId, proposalId: fresh.id, edits }).then(
      (r) => {
        if (!r.ok) {
          setPhase("review");
          return setCreateError(r.title ? `${r.title}: ${r.message}` : r.message);
        }
        setCreatedNr(r.session.dokNrPelny ?? "ZD");
        router.refresh();
        window.setTimeout(() => {
          setSession(r.session);
          setPhase("send");
        }, 700);
      },
      () => {
        // Wynik nieznany (zerwane połączenie) — ZD mogło powstać; bez ślepego ponawiania.
        setPhase("review");
        setCreateError("Brak odpowiedzi serwera. Sprawdź w Kreatorze ZD, czy dokument powstał, zanim spróbujesz ponownie.");
      }
    );
  };

  const unitsOf = (l: ZdAutoProposalLine) => edits[String(l.twId)] ?? l.zdUnits;
  const setUnits = (l: ZdAutoProposalLine, next: number | ((current: number) => number)) =>
    setEdits((e) => {
      const key = String(l.twId);
      const raw = typeof next === "function" ? next(e[key] ?? l.zdUnits) : next;
      const value = Math.max(0, Math.min(ZD_AUTO_PROPOSAL_EDIT_MAX_UNITS, raw));
      const copy = { ...e };
      if (value === l.zdUnits) delete copy[key];
      else copy[key] = value;
      return copy;
    });

  const diff = fresh ? diffZdAutoProposalLines(morning.lines, fresh.lines) : [];
  const editedCount = Object.keys(edits).length;
  const changes = diff.filter((d) => d.change !== "same");
  const activeLines = fresh ? fresh.lines.filter((l) => unitsOf(l) > 0) : [];
  const pieces = activeLines.reduce((a, l) => a + (l.zdUnits > 0 ? (l.pieces / l.zdUnits) * unitsOf(l) : 0), 0);
  const value = activeLines.reduce(
    (a, l) => a + (l.priceNet != null && l.zdUnits > 0 ? l.priceNet * (l.pieces / l.zdUnits) * unitsOf(l) : 0),
    0
  );
  const shown = diff.filter((d) =>
    filter === "changes" ? d.change !== "same" : filter === "edited" ? String(d.line.twId) in edits : true
  );

  // Oczekiwanie (przeliczenie, zapis w Subiekcie) pokazuje oś działań zamiast listy.
  const showTimeline = !fresh || creating;
  const prosbaLines = activeLines.filter((l) => l.prosbaPieces > 0).length;
  const cycle = morning.policy.cycleDays;
  const steps: Step[] = [
    {
      key: "recompute",
      title: "Przeliczenie na aktualnych stanach",
      status: recompute.status,
      message: recompute.status === "error" ? recompute.message : undefined,
      onRetry: recompute.status === "error" ? runRecompute : undefined,
      detail:
        recompute.status === "ok"
          ? `${activeLines.length} ${polishPluralWord(activeLines.length, "pozycja", "pozycje", "pozycji")} · ${
              changes.length ? `${changes.length} ${polishPluralWord(changes.length, "zmiana", "zmiany", "zmian")} wobec rana` : "bez zmian wobec rana"
            }${editedCount ? ` · ${editedCount} ${polishPluralWord(editedCount, "poprawiona", "poprawione", "poprawionych")}` : ""}.`
          : "Stany, prośby i strategia dostawcy - tak jak „Policz” w Kreatorze. Zwykle kilkanaście sekund.",
    },
    {
      key: "create",
      title: "Utworzenie ZD w Subiekcie",
      status: createdNr ? "ok" : creating ? "running" : "idle",
      message: createdNr ? `Utworzono ${createdNr}.` : undefined,
      detail: creating && !createdNr
        ? "Subiekt zapisuje dokument - przy dużym zamówieniu do 3 minut. Nie zamykaj panelu."
        : "W aktualnej bazie Subiekta, z ilościami z listy.",
    },
    { key: "mail", title: "Mail z zamówieniem do dostawcy", status: "idle", detail: "Podgląd i poprawki przed wysłaniem." },
    { key: "termin", title: "Termin realizacji na ZD", status: "idle", detail: "Przewidywana dostawa, ustawiana zaraz po wysyłce." },
    {
      key: "glowne",
      title: "Prośby handlowców",
      status: "idle",
      detail: !fresh
        ? "Prośby z listy oznaczę jako zamówione (Główne)."
        : prosbaLines
          ? `${prosbaLines} ${polishPluralWord(prosbaLines, "pozycja", "pozycje", "pozycji")} z prośbami - oznaczę je jako zamówione (Główne).`
          : "Brak próśb na tej liście.",
    },
    {
      key: "plan",
      title: "Plan zamówień",
      status: "idle",
      detail: `${supplierName} oznaczony jako zamówiony${cycle ? `; kolejna propozycja za ${cycle} ${polishPluralWord(cycle, "dzień", "dni", "dni")}` : ""}.`,
    },
  ];

  // Portal: panel w grupie uwagi dziedziczył jej kontekst warstw — telefon zakrywał go paskami aplikacji.
  return createPortal(
    <>
      <button
        ref={(el) => {
          backdropRef.current = el;
        }}
        type="button"
        className={cn(sidePanelBackdropClass, "panel-slide-backdrop-enter z-[60]")}
        aria-label="Zamknij panel"
        onClick={close}
      />
      <aside
        ref={(el) => {
          panelRef.current = el;
        }}
        role="dialog"
        aria-modal
        aria-labelledby="zd-auto-sheet-title"
        tabIndex={-1}
        // Blokada przewijania strony przepuszcza kółko i dotyk tylko w oznaczonych obszarach.
        {...{ [SCROLL_LOCK_ALLOW_ATTR]: "" }}
        className={cn(sidePanelShellClass, "panel-slide-enter z-[61] outline-none md:max-w-2xl")}
      >
        <header className={sidePanelHeaderClass}>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 id="zd-auto-sheet-title" className="text-lg font-semibold tracking-tight text-slate-900">
                Zamówienie {supplierName}
              </h2>
              <p className="mt-0.5 text-sm text-slate-600">
                Propozycja automatu z {formatWhen(morning.createdAt)} · co {morning.policy.cycleDays ?? "?"} dni
              </p>
            </div>
            <button type="button" className={sidePanelCloseButtonClass} aria-label="Zamknij" onClick={close} disabled={creating}>
              <IconX size={16} />
            </button>
          </div>
          <PhaseProgress phase={phase} />
        </header>

        <div className="flex-1 overflow-y-auto px-5 py-5">
          {phase === "send" && session ? (
            <div className="space-y-4">
              <p className="flex items-center gap-2 rounded-md bg-emerald-50 px-3 py-2.5 text-sm font-medium text-emerald-800">
                <IconCircleCheck size={16} aria-hidden />
                Utworzono {session.dokNrPelny ?? "ZD"} w Subiekcie. Teraz mail do dostawcy - sprawdź go przed wysłaniem.
              </p>
              <ZdEstimatePostCreatePanel
                embedded
                session={session}
                onDismiss={close}
                onOpenLink={() => router.push(`/zakupy/szacunek?supplierId=${encodeURIComponent(supplierId)}`)}
                onGlowneMarked={(res) =>
                  setSession((s) =>
                    s ? { ...s, glowneDone: true, glowneMarkedIds: [...s.glowneMarkedIds, ...res.processedIds] } : s
                  )
                }
                onScheduleMarked={() => setSession((s) => (s ? { ...s, scheduleDone: true } : s))}
              />
            </div>
          ) : (
            <div className="space-y-4">
              {showTimeline ? (
                <div role="status" aria-live="polite" className="rounded-lg border border-slate-200 px-4 py-4">
                  <ActionTimeline steps={steps} />
                </div>
              ) : (
                <p className="text-sm text-slate-600">
                  Przeliczone na stanach z tej chwili.{" "}
                  {changes.length
                    ? `Wobec rana ${changes.length} ${polishPluralWord(changes.length, "zmiana", "zmiany", "zmian")}.`
                    : "Bez zmian wobec rana."}{" "}
                  Popraw ilości, jeśli trzeba - zatwierdzisz dokładnie to, co widzisz.
                </p>
              )}

              {createError ? (
                <p className="flex items-start gap-2 rounded-md bg-red-50 px-3 py-2.5 text-sm text-red-700" role="alert">
                  <IconAlertCircle size={16} className="mt-0.5 shrink-0" aria-hidden /> {createError}
                </p>
              ) : null}

              {fresh && !showTimeline ? (
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <SegmentedControl
                    value={filter}
                    onChange={setFilter}
                    ariaLabel="Pokaż pozycje"
                    density="compact"
                    options={[
                      { value: "all", label: `Wszystkie (${diff.length})` },
                      { value: "changes", label: `Od rana (${changes.length})` },
                      { value: "edited", label: `Poprawione (${editedCount})` },
                    ]}
                  />
                  {editedCount ? (
                    <button
                      type="button"
                      className="inline-flex h-8 items-center gap-1 rounded-md px-2 text-xs font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                      onClick={() => {
                        setEdits({});
                        if (filter === "edited") setFilter("all");
                      }}
                      disabled={creating}
                    >
                      <IconUndoLeft size={13} aria-hidden /> Cofnij poprawki
                    </button>
                  ) : null}
                </div>
              ) : null}

              {showTimeline || !fresh ? null : (
                <>
                  <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200">
                    {shown.length === 0 ? (
                      <li className="px-3 py-6 text-center text-sm text-slate-500">Brak pozycji w tym widoku.</li>
                    ) : null}
                    {shown.map(({ line: l, change, beforeUnits }) => {
                      const units = change === "removed" ? 0 : unitsOf(l);
                      const removedByMe = change !== "removed" && units === 0;
                      const editedByMe = String(l.twId) in edits;
                      return (
                        <li
                          key={l.twId}
                          className={cn(
                            "grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-2 px-3 py-2.5 transition-colors duration-150 max-sm:grid-cols-1",
                            editedByMe && !removedByMe && "bg-indigo-50/60",
                            (removedByMe || change === "removed") && "bg-slate-50"
                          )}
                        >
                          <div className="min-w-0">
                            <p
                              className={cn(
                                "truncate text-sm",
                                removedByMe || change === "removed" ? "text-slate-500 line-through" : "text-slate-900"
                              )}
                              title={l.nazwa}
                            >
                              {l.nazwa}
                            </p>
                            <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500">
                              <span className="font-mono">{l.symbol}</span>
                              {l.prosbaPieces > 0 ? <span>prośby {formatQty(l.prosbaPieces)} szt</span> : null}
                              {change === "added" ? <Badge variant="info">nowa od rana</Badge> : null}
                              {change === "changed" && beforeUnits != null ? (
                                <Badge variant="warning">rano {formatQty(beforeUnits)}</Badge>
                              ) : null}
                              {change === "removed" ? <Badge>wypadła od rana</Badge> : null}
                              {editedByMe && !removedByMe ? <Badge variant="info">automat: {formatQty(l.zdUnits)}</Badge> : null}
                            </p>
                          </div>
                          {change === "removed" ? (
                            <span className="text-right text-xs text-slate-500">nie zamawiamy</span>
                          ) : removedByMe ? (
                            <button
                              type="button"
                              className="inline-flex h-10 items-center justify-self-end gap-1.5 rounded-md px-2.5 text-sm font-medium text-indigo-700 hover:bg-indigo-50 sm:h-8"
                              onClick={() => setUnits(l, l.zdUnits)}
                            >
                              <IconUndoLeft size={14} aria-hidden /> Przywróć
                            </button>
                          ) : (
                            <div className="flex items-center justify-end gap-2">
                              <UnitsStepper
                                line={l}
                                value={units}
                                onChange={(n) => setUnits(l, n)}
                                onStep={(d) => setUnits(l, (cur) => Math.max(1, cur + d))}
                                disabled={creating}
                              />
                              <span className="w-8 text-xs text-slate-500">{l.unitLabel}</span>
                              <button
                                type="button"
                                aria-label={`Usuń z zamówienia: ${l.nazwa}`}
                                className="flex h-10 w-10 items-center justify-center rounded-md text-slate-500 transition-colors hover:bg-red-50 hover:text-red-700 sm:h-8 sm:w-8"
                                onClick={() => setUnits(l, 0)}
                              >
                                <IconTrash2 size={15} aria-hidden />
                              </button>
                            </div>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                </>
              )}
              {creating ? null : (
              <p className="text-xs text-slate-500">
                Brakuje towaru?{" "}
                <a className="font-medium text-indigo-700 underline underline-offset-2" href={`/zakupy/szacunek?supplierId=${encodeURIComponent(supplierId)}`}>
                  Otwórz pełną listę w Kreatorze ZD
                </a>
                .
              </p>
              )}
            </div>
          )}
        </div>

        {phase !== "send" ? (
          <footer className="flex shrink-0 flex-col gap-3 border-t border-slate-100 bg-white/95 px-5 py-4 backdrop-blur-sm sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm tabular-nums text-slate-600" aria-live="polite">
              {fresh ? (
                <>
                  <span className="font-semibold text-slate-900">
                    {activeLines.length} {polishPluralWord(activeLines.length, "pozycja", "pozycje", "pozycji")}
                  </span>
                  {` · ${formatQty(Math.round(pieces))} szt · ok. ${zl(value)}`}
                  {editedCount ? <span className="text-indigo-700">{` · ${editedCount} ${polishPluralWord(editedCount, "poprawiona", "poprawione", "poprawionych")}`}</span> : null}
                </>
              ) : null}
            </p>
            <Button type="button" className="min-h-11 sm:min-h-10" onClick={runCreate} disabled={!fresh || creating || activeLines.length === 0}>
              {creating ? (
                <span className="inline-flex items-center gap-2">
                  <Spinner size="sm" /> Tworzę ZD w Subiekcie…
                </span>
              ) : (
                fresh ? `Zatwierdź i utwórz ZD (${activeLines.length})` : "Zatwierdź i utwórz ZD"
              )}
            </Button>
          </footer>
        ) : null}
      </aside>
    </>,
    document.body
  );
}
