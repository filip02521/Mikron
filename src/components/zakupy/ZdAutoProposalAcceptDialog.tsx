"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { actionAcceptZdAutoProposal, actionCreateZdAutoProposalNow } from "@/app/actions/zd-estimate";
import { IconAlertCircle, IconCheck } from "@/components/icons/StrokeIcons";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { ModalShell } from "@/components/ui/ModalShell";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { Spinner } from "@/components/ui/Spinner";
import { ZdEstimatePostCreatePanel } from "@/components/zakupy/ZdEstimatePostCreatePanel";
import { cn } from "@/lib/cn";
import type { ZdAutoProposal } from "@/lib/data/zd-auto-proposals";
import { polishPluralWord } from "@/lib/email/polish-plural";
import { diffZdAutoProposalLines } from "@/lib/orders/zd-auto-proposal-create";
import type { ZdPostCreateSession } from "@/lib/orders/zd-estimate-post-create";
import { formatQty } from "@/lib/orders/zd-estimate-manual";

type Status = "idle" | "running" | "ok" | "error";
type Step = { key: string; title: string; detail: React.ReactNode; status: Status; message?: string; onRetry?: () => void };

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

/** Pionowa oś działań: węzeł ze stanem, szyna wypełnia się po każdym zakończonym kroku. */
function ActionTimeline({ steps }: { steps: Step[] }) {
  return (
    <ol className="relative" aria-label="Działania po akceptacji">
      {steps.map((s, i) => {
        const last = i === steps.length - 1;
        return (
          <li key={s.key} className="relative flex gap-3 pb-4 last:pb-0" aria-current={s.status === "running" ? "step" : undefined}>
            {!last ? (
              <span
                aria-hidden
                className={cn(
                  "absolute top-8 bottom-1 left-[0.9375rem] w-px transition-colors duration-300 motion-reduce:transition-none",
                  s.status === "ok" ? "bg-emerald-300" : "bg-slate-200"
                )}
              />
            ) : null}
            <span
              aria-hidden
              className={cn(
                "relative z-[1] flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold tabular-nums transition-colors duration-200 motion-reduce:transition-none",
                s.status === "ok" && "bg-emerald-600 text-white",
                s.status === "error" && "bg-red-600 text-white",
                s.status === "running" && "bg-indigo-50 text-indigo-700 ring-2 ring-indigo-600",
                s.status === "idle" && "bg-white text-slate-500 ring-1 ring-slate-300"
              )}
            >
              {s.status === "ok" ? (
                <IconCheck size={15} strokeWidth={2.5} />
              ) : s.status === "error" ? (
                <IconAlertCircle size={15} />
              ) : s.status === "running" ? (
                <Spinner size="sm" />
              ) : (
                i + 1
              )}
            </span>
            <div className="min-w-0 flex-1 pt-1">
              <p className={cn("text-sm font-semibold", s.status === "idle" ? "text-slate-600" : "text-slate-900")}>
                {s.title}
              </p>
              {/* Kroki, które jeszcze nie ruszyły: cicho, a na wąskim ekranie bez opisu (lista ważniejsza). */}
              <div
                className={cn(
                  "mt-0.5 leading-snug",
                  s.status === "idle" ? "text-xs text-slate-500 max-lg:hidden" : "text-sm text-slate-600"
                )}
              >
                {s.detail}
              </div>
              {s.message ? (
                <p
                  className={cn("mt-1 text-sm", s.status === "error" ? "text-red-700" : "text-slate-600")}
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

/**
 * Panel dzienny: akceptacja propozycji ZD automatu. Przeliczenie na aktualnych stanach (różnice
 * wobec rana) → Utwórz ZD w Subiekcie → panel po utworzeniu (mail, termin, Główne, plan).
 */
export function ZdAutoProposalAcceptDialog({
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
  const [recompute, setRecompute] = useState<{ status: Status; message?: string }>({ status: "running" });
  const [fresh, setFresh] = useState<ZdAutoProposal | null>(null);
  const [create, setCreate] = useState<{ status: Status; message?: string }>({ status: "idle" });
  const [session, setSession] = useState<ZdPostCreateSession | null>(null);
  const [filter, setFilter] = useState<"all" | "changes">("all");
  const started = useRef(false);

  const runRecompute = () => {
    setRecompute({ status: "running" });
    setFresh(null);
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
    setCreate({ status: "running", message: "Subiekt tworzy dokument - zwykle kilkanaście sekund." });
    void actionAcceptZdAutoProposal({ supplierId, proposalId: fresh.id }).then(
      (r) => {
        if (!r.ok) return setCreate({ status: "error", message: r.title ? `${r.title}: ${r.message}` : r.message });
        setCreate({ status: "ok", message: r.session.dokNrPelny ?? undefined });
        router.refresh();
        // Krótko pokaż ukończony krok, potem panel wysyłki.
        window.setTimeout(() => setSession(r.session), 650);
      },
      // Wynik nieznany (zerwane połączenie) — ZD mogło powstać; bez ślepego ponawiania.
      () =>
        setCreate({
          status: "error",
          message: "Brak odpowiedzi serwera. Sprawdź w Kreatorze ZD, czy dokument powstał, zanim spróbujesz ponownie.",
        })
    );
  };

  if (session) {
    return (
      <ZdEstimatePostCreatePanel
        session={session}
        onDismiss={onClose}
        onOpenLink={() => router.push(`/zakupy/szacunek?supplierId=${encodeURIComponent(supplierId)}`)}
        onGlowneMarked={(res) =>
          setSession((s) => (s ? { ...s, glowneDone: true, glowneMarkedIds: [...s.glowneMarkedIds, ...res.processedIds] } : s))
        }
        onScheduleMarked={() => setSession((s) => (s ? { ...s, scheduleDone: true } : s))}
      />
    );
  }

  const diff = fresh ? diffZdAutoProposalLines(morning.lines, fresh.lines) : [];
  const changes = diff.filter((d) => d.change !== "same");
  const shownLines = filter === "changes" ? changes : diff;
  const pieces = fresh ? fresh.lines.reduce((a, l) => a + l.pieces, 0) : 0;
  const prosbaLines = fresh ? fresh.lines.filter((l) => l.prosbaPieces > 0).length : 0;
  const busy = recompute.status === "running" || create.status === "running";
  const pending: Status = "idle";

  const steps: Step[] = [
    {
      key: "recompute",
      title: "Przeliczenie na aktualnych stanach",
      status: recompute.status,
      message: recompute.message,
      onRetry: recompute.status === "error" ? runRecompute : undefined,
      detail:
        recompute.status === "ok"
          ? changes.length
            ? `${changes.length} ${polishPluralWord(changes.length, "zmiana", "zmiany", "zmian")} wobec propozycji z ${formatWhen(morning.createdAt)}.`
            : `Bez zmian wobec propozycji z ${formatWhen(morning.createdAt)}.`
          : "Lista liczona tak jak w Kreatorze, na stanach z tej chwili.",
    },
    {
      key: "create",
      title: "Utworzenie ZD w Subiekcie",
      status: create.status,
      message: create.status === "ok" ? `Utworzono ${create.message ?? "ZD"}.` : create.message,
      onRetry: create.status === "error" && fresh ? runCreate : undefined,
      detail: "W aktualnej bazie Subiekta. Dokumentu nie cofniesz z OnTime.",
    },
    {
      key: "mail",
      title: "Mail z zamówieniem do dostawcy",
      status: pending,
      detail: "Podgląd i poprawki adresu, tematu i treści przed wysłaniem.",
    },
    {
      key: "termin",
      title: "Termin realizacji na ZD",
      status: pending,
      detail: "Przewidywana dostawa, ustawiana zaraz po wysyłce.",
    },
    {
      key: "glowne",
      title: "Prośby handlowców",
      status: pending,
      detail: prosbaLines
        ? `${prosbaLines} ${polishPluralWord(prosbaLines, "pozycja", "pozycje", "pozycji")} z prośbami - oznaczę je jako zamówione (Główne).`
        : "Brak próśb na tej liście.",
    },
    {
      key: "plan",
      title: "Plan zamówień",
      status: pending,
      detail: `${supplierName} oznaczony jako zamówiony; kolejna propozycja za ${morning.policy.cycleDays ?? "?"} dni.`,
    },
  ];

  return (
    <ModalShell
      open
      onClose={onClose}
      title={`Zamówienie ${supplierName} do potwierdzenia`}
      description={`Propozycja automatu z ${formatWhen(morning.createdAt)} · cykl co ${morning.policy.cycleDays ?? "?"} dni`}
      size="xl"
      disableBackdropClose={busy}
      bodyClassName="px-5 py-5 sm:px-6"
      footer={
        <div className="flex w-full flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-slate-600 tabular-nums" aria-live="polite">
            {fresh ? (
              <>
                <span className="font-semibold text-slate-900">
                  {fresh.lineCount} {polishPluralWord(fresh.lineCount, "pozycja", "pozycje", "pozycji")}
                </span>
                {` · ${formatQty(pieces)} szt · ok. ${zl(fresh.valueNet)}`}
              </>
            ) : recompute.status === "running" ? (
              "Przeliczam…"
            ) : null}
          </p>
          <div className="flex flex-col-reverse gap-2 sm:flex-row">
            <Button type="button" variant="ghost" className="min-h-11 sm:min-h-10" onClick={onClose} disabled={create.status === "running"}>
              Anuluj
            </Button>
            <Button type="button" className="min-h-11 sm:min-h-10" onClick={runCreate} disabled={!fresh || busy || create.status === "ok"}>
              {create.status === "running" ? "Tworzę ZD…" : fresh ? `Zatwierdź i utwórz ZD (${fresh.lineCount})` : "Zatwierdź i utwórz ZD"}
            </Button>
          </div>
        </div>
      }
    >
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,19rem)_minmax(0,1fr)]">
        <ActionTimeline steps={steps} />

        <section aria-label="Pozycje zamówienia" className="min-w-0 space-y-2.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-semibold text-slate-900">Pozycje</h3>
            {fresh && changes.length ? (
              <SegmentedControl
                value={filter}
                onChange={setFilter}
                ariaLabel="Pokaż pozycje"
                density="compact"
                options={[
                  { value: "all", label: `Wszystkie (${diff.length})` },
                  { value: "changes", label: `Zmiany (${changes.length})` },
                ]}
              />
            ) : null}
          </div>
          {!fresh ? (
            <div className="space-y-2" aria-hidden>
              {Array.from({ length: 6 }, (_, i) => (
                <div key={i} className="h-9 animate-pulse rounded-md bg-slate-100 motion-reduce:animate-none" />
              ))}
            </div>
          ) : (
            <ul className="max-h-[min(26rem,52vh)] divide-y divide-slate-100 overflow-y-auto rounded-lg border border-slate-200 bg-white">
              {shownLines.map(({ line: l, change, beforeUnits }) => (
                <li
                  key={l.twId}
                  className={cn(
                    "grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 px-3 py-2 text-sm",
                    change === "removed" && "bg-slate-50"
                  )}
                >
                  <div className="min-w-0">
                    <p className={cn("truncate", change === "removed" ? "text-slate-500 line-through" : "text-slate-900")} title={l.nazwa}>
                      {l.nazwa}
                    </p>
                    <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-slate-500">
                      <span className="font-mono">{l.symbol}</span>
                      {l.prosbaPieces > 0 ? <span>w tym prośby {formatQty(l.prosbaPieces)} szt</span> : null}
                      {change === "added" ? <Badge variant="info">nowa</Badge> : null}
                      {change === "removed" ? <Badge>usunięta</Badge> : null}
                      {change === "changed" ? <Badge variant="warning">zmieniona</Badge> : null}
                    </p>
                  </div>
                  <p className="text-right tabular-nums">
                    {change === "changed" && beforeUnits != null ? (
                      <span className="mr-1.5 text-xs text-slate-500 line-through">{formatQty(beforeUnits)}</span>
                    ) : null}
                    <span className={cn("font-semibold", change === "removed" ? "text-slate-500" : "text-slate-900")}>
                      {formatQty(change === "removed" ? 0 : l.zdUnits)}
                    </span>{" "}
                    <span className="text-xs text-slate-500">{l.unitLabel}</span>
                    {change !== "removed" && l.pieces !== l.zdUnits ? (
                      <span className="block text-xs text-slate-500">{formatQty(l.pieces)} szt</span>
                    ) : null}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </ModalShell>
  );
}
