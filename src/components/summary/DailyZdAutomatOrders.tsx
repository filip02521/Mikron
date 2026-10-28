"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { actionListZdAutoProposals } from "@/app/actions/zd-estimate";
import { Button } from "@/components/ui/Button";
import { useDailyZdProposalMap } from "@/components/summary/DailyZdProposals";
import { ZdAutoProposalSheet } from "@/components/zakupy/ZdAutoProposalSheet";
import { cn } from "@/lib/cn";
import type { ZdAutoProposal } from "@/lib/data/zd-auto-proposals";
import { polishPluralWord } from "@/lib/email/polish-plural";
import {
  formatAutomatDay,
  warsawKeyFromIso,
  zdAutomatTodayStageStep,
  type ZdAutomatTodayOrder,
  type ZdAutomatTodayStage,
} from "@/lib/orders/zd-automat-daily";
import { buildZdPostCreateSessionFromLink, type ZdPostCreateSession } from "@/lib/orders/zd-estimate-post-create";
import { panelSubsectionInsetClass } from "@/lib/ui/ontime-theme";

const zl = (v: number) => `${Math.round(v).toLocaleString("pl-PL")} zł`;
const timeOf = (iso: string) =>
  new Date(iso).toLocaleTimeString("pl-PL", { timeZone: "Europe/Warsaw", hour: "2-digit", minute: "2-digit" });

/** Te same trzy etapy co w panelu „Sprawdź i wyślij” — postęp widać bez otwierania. */
const STEPS = ["Sprawdzenie", "ZD w Subiekcie", "Mail do dostawcy"] as const;

function stageText(o: ZdAutomatTodayOrder, todayKey: string): { text: string; tone: "neutral" | "warning" | "success" } {
  const nr = o.proposal.dokNr ?? "ZD";
  switch (o.stage) {
    case "review": {
      const day = warsawKeyFromIso(o.proposal.createdAt);
      return { text: day === todayKey ? "do sprawdzenia" : `do sprawdzenia, czeka od ${formatAutomatDay(day, todayKey)}`, tone: "neutral" };
    }
    case "unconfirmed":
      return { text: "Subiekt nie potwierdził zapisu ZD - sprawdź w Subiekcie, zanim zamówisz ponownie", tone: "warning" };
    case "send":
      return { text: `${nr} w Subiekcie · zamówienie jeszcze nie wysłane do dostawcy`, tone: "warning" };
    case "sent":
      return { text: `${nr} · wysłane do dostawcy ${timeOf(o.proposal.mailSentAt!)}`, tone: "success" };
    case "rejected":
      return { text: "odrzucona", tone: "neutral" };
  }
}

function StageBar({ stage }: { stage: ZdAutomatTodayStage }) {
  const done = zdAutomatTodayStageStep(stage);
  const closed = stage === "rejected";
  return (
    <span
      className="grid w-full grid-cols-3 gap-1 sm:w-32"
      role="img"
      aria-label={closed ? "Odrzucona" : `Etap ${Math.min(done + 1, 3)} z 3: ${STEPS[Math.min(done, 2)]}${done === 3 ? " - gotowe" : ""}`}
    >
      {STEPS.map((label, i) => (
        <span
          key={label}
          title={label}
          className={cn(
            "h-1 rounded-full transition-colors duration-300 motion-reduce:transition-none",
            closed ? "bg-slate-200" : i < done ? "bg-indigo-600" : i === done ? "bg-indigo-300" : "bg-slate-200"
          )}
        />
      ))}
    </span>
  );
}

/** ZD z tej propozycji już jest — sesja panelu wysyłki jak po „Powiąż” w Kreatorze (bez ponownego zapisu). */
function resumeSessionFor(p: ZdAutoProposal, supplierName: string, dokNr: string | null): ZdPostCreateSession {
  return buildZdPostCreateSessionFromLink({
    supplierId: p.supplierId,
    supplierName,
    fromDaily: true,
    dokId: p.dokId,
    dokNrPelny: dokNr ?? "",
    lineCount: p.finalLines ? Object.keys(p.finalLines).length : p.lineCount,
    previewLines: p.lines.map((l) => ({
      twId: l.twId,
      symbol: l.symbol,
      nazwa: l.nazwa,
      ilosc: l.zdUnits,
      packagingHint: l.unitLabel !== "szt" ? l.unitLabel : null,
      individualExtraPieces: l.prosbaPieces,
      piecesArriving: l.pieces,
    })),
    createdLines: p.finalLines ? Object.entries(p.finalLines).map(([twId, ilosc]) => ({ twId: Number(twId), ilosc })) : null,
  });
}

type Open = { order: ZdAutomatTodayOrder; proposal: ZdAutoProposal; resume: ZdPostCreateSession | null };

/**
 * Panel dzienny → sekcja „Automat ZD”: zamówienia automatu na dziś z etapem (sprawdzenie → ZD w Subiekcie → mail)
 * i jedną akcją, która prowadzi do następnego etapu w tym samym panelu bocznym co wiersz kolejki.
 */
export function DailyZdAutomatOrders({ orders, todayKey }: { orders: readonly ZdAutomatTodayOrder[]; todayKey: string }) {
  const router = useRouter();
  const pendingMap = useDailyZdProposalMap();
  const [open, setOpen] = useState<Open | null>(null);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [error, setError] = useState<{ id: string; message: string } | null>(null);

  const start = async (o: ZdAutomatTodayOrder) => {
    setError(null);
    const known = pendingMap.get(o.supplierId);
    let proposal: ZdAutoProposal | null = known?.id === o.proposal.id ? known : null;
    if (!proposal) {
      setLoadingId(o.proposal.id);
      const r = await actionListZdAutoProposals({ supplierId: o.supplierId }).catch(() => null);
      setLoadingId(null);
      proposal = r?.ok ? (r.proposals.find((p) => p.id === o.proposal.id) ?? null) : null;
      if (!proposal) {
        setError({ id: o.proposal.id, message: r && !r.ok ? r.message : "Nie udało się wczytać zamówienia - odśwież stronę." });
        return;
      }
    }
    const resume = o.stage === "send" && proposal.dokId ? resumeSessionFor(proposal, o.supplierName, o.proposal.dokNr) : null;
    setOpen({ order: o, proposal, resume });
  };

  return (
    <>
      <ul className="divide-y divide-slate-100 border-t border-slate-200 bg-[var(--card)]" aria-label="Zamówienia automatu na dziś">
        {orders.map((o) => {
          const st = stageText(o, todayKey);
          const action =
            o.stage === "review"
              ? { label: "Sprawdź i wyślij", variant: "outline" as const }
              : o.stage === "send"
                ? { label: "Wyślij mail", variant: "outline" as const }
                : o.stage === "unconfirmed"
                  ? { label: "Sprawdź", variant: "ghost" as const }
                  : null;
          const busy = loadingId === o.proposal.id;
          return (
            <li
              key={o.proposal.id}
              className={cn(
                "grid grid-cols-1 gap-x-4 gap-y-2 py-3 sm:grid-cols-[minmax(0,1fr)_8rem_10rem] sm:items-center",
                panelSubsectionInsetClass
              )}
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-slate-900">{o.supplierName}</p>
                <p className="text-xs tabular-nums text-slate-600">
                  <span className="whitespace-nowrap">
                    {o.proposal.lineCount} {polishPluralWord(o.proposal.lineCount, "pozycja", "pozycje", "pozycji")}
                  </span>{" "}
                  · <span className="whitespace-nowrap">ok. {zl(o.proposal.valueNet)}</span>
                </p>
                <p
                  className={cn(
                    "text-xs",
                    st.tone === "warning" ? "text-amber-800" : st.tone === "success" ? "text-emerald-800" : "text-slate-600"
                  )}
                >
                  {st.text}
                </p>
                {error?.id === o.proposal.id ? (
                  <p className="mt-0.5 text-xs text-red-700" role="alert">
                    {error.message}
                  </p>
                ) : null}
              </div>
              <StageBar stage={o.stage} />
              <span className="flex sm:justify-end">
                {action ? (
                  <Button
                    type="button"
                    variant={action.variant}
                    size="sm"
                    className="min-h-11 w-full font-semibold sm:min-h-8 sm:w-auto"
                    onClick={() => void start(o)}
                    disabled={busy}
                  >
                    {busy ? "Wczytuję…" : action.label}
                  </Button>
                ) : null}
              </span>
            </li>
          );
        })}
      </ul>

      {open ? (
        <ZdAutoProposalSheet
          supplierId={open.order.supplierId}
          supplierName={open.order.supplierName}
          morning={open.proposal}
          resumeSession={open.resume}
          onClose={() => {
            setOpen(null);
            // Etap w wierszu (ZD, mail) pochodzi z serwera.
            router.refresh();
          }}
        />
      ) : null}
    </>
  );
}
