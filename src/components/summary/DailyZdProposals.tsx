"use client";

import { createContext, useContext, useId, useMemo, useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { actionRejectZdAutoProposal } from "@/app/actions/zd-estimate";
import { IconPackageCheck } from "@/components/icons/StrokeIcons";
import { Button } from "@/components/ui/Button";
import { fieldControlClass } from "@/components/ui/Field";
import { ModalShell } from "@/components/ui/ModalShell";
import { ZdAutoProposalSheet } from "@/components/zakupy/ZdAutoProposalSheet";
import { cn } from "@/lib/cn";
import type { ZdAutoProposal } from "@/lib/data/zd-auto-proposals";
import { polishPluralWord } from "@/lib/email/polish-plural";
import { formatQty } from "@/lib/orders/zd-estimate-manual";
import { panelTypography } from "@/lib/ui/ontime-theme";

export type DailyZdProposal = ZdAutoProposal & { supplierName: string };

const DailyZdProposalsContext = createContext<ReadonlyMap<string, DailyZdProposal>>(new Map());

/** Czekające propozycje ZD automatu (dostawca → propozycja) dla wierszy harmonogramu. */
export function DailyZdProposalsProvider({ proposals, children }: { proposals: DailyZdProposal[]; children: ReactNode }) {
  const map = useMemo(() => new Map(proposals.map((p) => [p.supplierId, p])), [proposals]);
  return <DailyZdProposalsContext.Provider value={map}>{children}</DailyZdProposalsContext.Provider>;
}

export function useDailyZdProposal(supplierId: string): DailyZdProposal | null {
  return useContext(DailyZdProposalsContext).get(supplierId) ?? null;
}

/** Propozycje dostawców, których nie ma w zaległych ani w dzisiejszym harmonogramie. */
export function useDailyZdProposalsOutside(scheduledSupplierIds: readonly string[]): DailyZdProposal[] {
  const map = useContext(DailyZdProposalsContext);
  return useMemo(() => {
    const scheduled = new Set(scheduledSupplierIds);
    return [...map.values()].filter((p) => !scheduled.has(p.supplierId));
  }, [map, scheduledSupplierIds]);
}

function formatWhen(iso: string): string {
  return new Date(iso).toLocaleString("pl-PL", {
    timeZone: "Europe/Warsaw",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

const zl = (v: number) => `${Math.round(v).toLocaleString("pl-PL")} zł`;

/**
 * Zamówienie automatu w wierszu dostawcy harmonogramu: co jest gotowe, „Sprawdź i zatwierdź”
 * (panel boczny: przeliczenie, korekta, ZD w Subiekcie, wysyłka) i „Odrzuć” z powodem.
 */
export function DailyZdProposalNotice({ proposal, className }: { proposal: DailyZdProposal; className?: string }) {
  const router = useRouter();
  const [reviewing, setReviewing] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const noteId = useId();
  const pieces = proposal.lines.reduce((a, l) => a + l.pieces, 0);
  const cycle = proposal.policy.cycleDays;
  // Bezpieczniki automatu: pozycje do sprawdzenia i nietypowo wysoka wartość — widać już w wierszu.
  const flaggedCount = proposal.lines.filter((l) => l.flags?.length).length;
  const valueJump = proposal.flags.includes("order_value_jump");
  const warnings = [
    flaggedCount ? `${flaggedCount} do sprawdzenia` : null,
    valueJump ? "wartość nietypowo wysoka" : null,
  ].filter(Boolean);

  const reject = () => {
    setError(null);
    startTransition(async () => {
      const r = await actionRejectZdAutoProposal({ id: proposal.id, supplierId: proposal.supplierId, note });
      if (!r.ok) return setError(r.message);
      setRejecting(false);
      router.refresh();
    });
  };

  return (
    <>
      <div
        className={cn(
          "flex flex-col gap-2.5 rounded-md bg-indigo-50/70 px-3 py-2.5 sm:flex-row sm:items-center sm:gap-3",
          className
        )}
      >
        <div className="flex min-w-0 flex-1 items-start gap-2.5">
          <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-md bg-white text-indigo-700 ring-1 ring-indigo-100" aria-hidden>
            <IconPackageCheck size={15} strokeWidth={2.25} />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-semibold leading-snug text-slate-900">Zamówienie gotowe do potwierdzenia</p>
            <p className="mt-0.5 text-xs leading-snug text-slate-600">
              <span className="tabular-nums">
                {proposal.lineCount} {polishPluralWord(proposal.lineCount, "pozycja", "pozycje", "pozycji")} · {formatQty(pieces)} szt ·
                ok. {zl(proposal.valueNet)}
              </span>
              <span className="text-slate-500">
                {" "}
                · automat{cycle ? ` co ${cycle} ${polishPluralWord(cycle, "dzień", "dni", "dni")}` : ""}, {formatWhen(proposal.createdAt)}
              </span>
            </p>
            {warnings.length ? (
              <p className="mt-0.5 text-xs font-medium leading-snug text-amber-800">{warnings.join(" · ")}</p>
            ) : null}
          </div>
        </div>
        <div className="flex shrink-0 items-center justify-end gap-1.5">
          <button
            type="button"
            className="inline-flex h-10 items-center rounded-md px-2.5 text-sm font-medium text-slate-600 transition-colors hover:bg-white hover:text-slate-900 sm:h-8 sm:text-xs"
            onClick={() => setRejecting(true)}
          >
            Odrzuć
          </button>
          <Button type="button" size="sm" className="min-h-10 sm:min-h-8" onClick={() => setReviewing(true)}>
            Sprawdź i zatwierdź
          </Button>
        </div>
      </div>

      {reviewing ? (
        <ZdAutoProposalSheet
          supplierId={proposal.supplierId}
          supplierName={proposal.supplierName}
          morning={proposal}
          onClose={() => {
            setReviewing(false);
            // Po zatwierdzeniu dostawca schodzi z harmonogramu, po przeliczeniu propozycja jest nowa.
            router.refresh();
          }}
        />
      ) : null}

      {rejecting ? (
        <ModalShell
          open
          onClose={() => setRejecting(false)}
          title={`Odrzuć zamówienie ${proposal.supplierName}`}
          size="md"
          bodyClassName="space-y-3 px-5 py-5 sm:px-6"
          loadingMessage={pending ? "Zapisuję…" : null}
          disableBackdropClose={pending}
          footer={
            <div className="flex w-full justify-end gap-2">
              <Button type="button" variant="secondary" onClick={() => setRejecting(false)} disabled={pending}>
                Anuluj
              </Button>
              <Button type="button" onClick={reject} disabled={pending}>
                Odrzuć
              </Button>
            </div>
          }
        >
          <p className={panelTypography.sectionDesc}>
            Termin w harmonogramie zostaje - zamówisz jak zwykle w Kreatorze ZD albo przesuniesz termin.
          </p>
          <label htmlFor={noteId} className="block text-sm font-medium text-slate-800">
            Dlaczego? (np. „za dużo gipsu”, „dostawca ma przestój”)
          </label>
          <textarea
            id={noteId}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={3}
            className={fieldControlClass("default", "resize-y")}
          />
          {error ? (
            <p className="text-sm text-red-700" role="alert">
              {error}
            </p>
          ) : null}
        </ModalShell>
      ) : null}
    </>
  );
}
