"use client";

import { useCallback, useEffect, useId, useState, useTransition } from "react";
import {
  actionCreateZdAutoProposalNow,
  actionListZdAutoProposals,
  actionRejectZdAutoProposal,
} from "@/app/actions/zd-estimate";
import { IconPackageCheck } from "@/components/icons/StrokeIcons";
import { Button } from "@/components/ui/Button";
import { fieldControlClass } from "@/components/ui/Field";
import { PageAttentionStrip, PageAttentionStripCta } from "@/components/ui/PageAttentionStrip";
import { ZdAutoProposalAcceptDialog } from "@/components/zakupy/ZdAutoProposalAcceptDialog";
import { polishPluralWord } from "@/lib/email/polish-plural";
import { ModalShell } from "@/components/ui/ModalShell";
import type { ZdAutoProposal } from "@/lib/data/zd-auto-proposals";
import { formatQty } from "@/lib/orders/zd-estimate-manual";

function formatDateTimePl(iso: string): string {
  return new Date(iso).toLocaleString("pl-PL", {
    timeZone: "Europe/Warsaw",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Drugorzędne akcje w pasku: tekst bez ramki, ta sama wysokość co CTA. */
const quietActionClass =
  "inline-flex h-8 items-center rounded-md px-2 text-xs font-medium text-slate-600 transition-colors hover:bg-white/70 hover:text-slate-900 disabled:opacity-60";

function zl(v: number): string {
  return `${Math.round(v).toLocaleString("pl-PL")} zł`;
}

const STATUS_LABEL: Record<ZdAutoProposal["status"], string> = {
  pending: "czeka",
  accepted: "zaakceptowana",
  rejected: "odrzucona",
  expired: "wygasła",
};

/** Różnice propozycja → utworzone ZD (jednostki ZD) do historii. */
export function zdAutoProposalDiff(p: Pick<ZdAutoProposal, "lines" | "finalLines">): {
  same: number;
  changed: number;
  removed: number;
  added: number;
} {
  const fin = p.finalLines ?? {};
  let same = 0, changed = 0, removed = 0;
  const proposed = new Set<string>();
  for (const l of p.lines) {
    const key = String(l.twId);
    proposed.add(key);
    const f = fin[key];
    if (f == null) removed += 1;
    else if (Math.abs(f - l.zdUnits) < 1e-9) same += 1;
    else changed += 1;
  }
  const added = Object.keys(fin).filter((k) => !proposed.has(k)).length;
  return { same, changed, removed, added };
}

/**
 * Propozycja ZD automatu dla wybranego dostawcy (strategia testowa). Akceptacja zapisuje się
 * sama przy „Utwórz ZD” (z Twoimi zmianami); tu: podgląd, odrzucenie z powodem i historia.
 */
export function ZdAutoProposalBanner({
  supplierId,
  supplierName,
  inDailyPanel = false,
}: {
  supplierId: string;
  supplierName: string;
  /** Panel dzienny: wiersz w grupie uwagi, dostawca w tytule i „Akceptuj” (ZD + wysyłka bez Kreatora). */
  inDailyPanel?: boolean;
}) {
  const [proposals, setProposals] = useState<ZdAutoProposal[] | null>(null);
  const [open, setOpen] = useState(false);
  const [accepting, setAccepting] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const noteId = useId();

  const load = useCallback(() => {
    void actionListZdAutoProposals({ supplierId }).then((r) => {
      if (r.ok) setProposals(r.proposals);
    });
  }, [supplierId]);
  useEffect(() => {
    let cancelled = false;
    void actionListZdAutoProposals({ supplierId }).then((r) => {
      if (!cancelled && r.ok) setProposals(r.proposals);
    });
    return () => {
      cancelled = true;
    };
  }, [supplierId]);

  const [building, startBuilding] = useTransition();
  const buildNow = () => {
    setError(null);
    startBuilding(async () => {
      const r = await actionCreateZdAutoProposalNow({ supplierId });
      if (!r.ok) return setError(r.message);
      if (!r.proposal) setError("Nic do zamówienia - propozycja nie powstała.");
      load();
    });
  };

  const latest = proposals?.[0] ?? null;
  if (proposals == null) return null;
  // Panel dzienny pokazuje tylko czekające — po decyzji wiersz znika.
  if (inDailyPanel && latest?.status !== "pending" && !accepting) return null;
  if (!latest) {
    return (
      <PageAttentionStrip
        tone="violet"
        icon={<IconPackageCheck size={16} strokeWidth={2.25} />}
        title="Brak propozycji ZD"
        hint={error ?? "pierwsza powstanie przy porannym przebiegu albo teraz."}
        actions={
          <PageAttentionStripCta tone="violet" chevron={false} onClick={buildNow} disabled={building}>
            {building ? "Liczę…" : "Przygotuj teraz"}
          </PageAttentionStripCta>
        }
      />
    );
  }
  const waiting = latest.status === "pending";
  const pieces = latest.lines.reduce((a, l) => a + l.pieces, 0);

  const reject = () => {
    setError(null);
    startTransition(async () => {
      const r = await actionRejectZdAutoProposal({ id: latest.id, supplierId, note });
      if (!r.ok) return setError(r.message);
      setRejecting(false);
      setNote("");
      load();
    });
  };

  return (
    <>
      <PageAttentionStrip
        tone="violet"
        edge={inDailyPanel ? "row" : undefined}
        icon={<IconPackageCheck size={16} strokeWidth={2.25} />}
        title={
          inDailyPanel
            ? `Zamówienie ${supplierName} do potwierdzenia`
            : `${waiting ? "Propozycja ZD" : "Ostatnia propozycja ZD"} z ${formatDateTimePl(latest.createdAt)}`
        }
        hint={
          error && !rejecting ? (
            <span className="text-red-700">{error}</span>
          ) : (
            <span className="tabular-nums">
              {latest.lineCount} {polishPluralWord(latest.lineCount, "pozycja", "pozycje", "pozycji")} ·{" "}
              {formatQty(pieces)} szt · ok. {zl(latest.valueNet)}
              {!waiting ? ` · ${STATUS_LABEL[latest.status]}` : ""}
              {inDailyPanel ? ` · z ${formatDateTimePl(latest.createdAt)}` : ""}
            </span>
          )
        }
        actions={
          <>
            {/* Panel dzienny: przeliczenie i podgląd są w oknie akceptacji. */}
            {!inDailyPanel ? (
              <button type="button" className={quietActionClass} onClick={buildNow} disabled={building}>
                {building ? "Liczę…" : "Przelicz"}
              </button>
            ) : null}
            {waiting ? (
              <button type="button" className={quietActionClass} onClick={() => setRejecting(true)}>
                Odrzuć
              </button>
            ) : null}
            {inDailyPanel ? (
              waiting ? (
                <PageAttentionStripCta tone="violet" onClick={() => setAccepting(true)}>
                  Sprawdź i zatwierdź
                </PageAttentionStripCta>
              ) : null
            ) : (
              <PageAttentionStripCta tone="violet" onClick={() => setOpen(true)}>
                Pokaż propozycję
              </PageAttentionStripCta>
            )}
          </>
        }
      />

      {open ? (
        <ModalShell
          open
          onClose={() => setOpen(false)}
          title={`Propozycja ZD - ${supplierName}`}
          size="lg"
          bodyClassName="space-y-4 px-5 py-5 sm:px-6"
        >
          <p className="text-sm text-slate-600">
            Policzona {formatDateTimePl(latest.createdAt)} strategią testową
            {latest.policy.targetDays ? ` (${latest.policy.targetDays} dni zapasu, co ${latest.policy.cycleDays ?? "?"} dni)` : ""}.
            Policz w Kreatorze liczy tak samo - popraw ilości w tabeli i Utwórz ZD; propozycja zapisze się jako
            zaakceptowana razem z Twoimi zmianami.
          </p>
          <ul className="divide-y divide-slate-100 rounded-md border border-slate-200">
            {latest.lines.map((l) => (
              <li key={l.twId} className="flex items-baseline justify-between gap-3 px-3 py-1.5 text-sm">
                <span className="min-w-0 truncate text-slate-800" title={l.nazwa}>
                  <span className="mr-2 font-mono text-xs text-slate-500">{l.symbol}</span>
                  {l.nazwa}
                  {l.floor ? <span className="ml-2 text-xs text-indigo-700">średnia 90 d</span> : null}
                  {l.prosbaPieces > 0 ? (
                    <span className="ml-2 text-xs text-slate-500">w tym prośby {formatQty(l.prosbaPieces)} szt</span>
                  ) : null}
                </span>
                <span className="shrink-0 tabular-nums font-medium text-slate-900">
                  {formatQty(l.zdUnits)} {l.unitLabel}
                  {l.pieces !== l.zdUnits ? <span className="ml-1 text-xs text-slate-500">= {formatQty(l.pieces)} szt</span> : null}
                </span>
              </li>
            ))}
          </ul>
          {proposals && proposals.length > 1 ? (
            <section>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-600">Historia propozycji</h3>
              <ul className="mt-1.5 divide-y divide-slate-100 rounded-md border border-slate-200">
                {proposals.slice(1).map((p) => {
                  const d = p.status === "accepted" ? zdAutoProposalDiff(p) : null;
                  return (
                    <li key={p.id} className="flex items-baseline justify-between gap-3 px-3 py-1.5 text-sm">
                      <span className="text-slate-700">
                        <span className="tabular-nums">{formatDateTimePl(p.createdAt)}</span> · {p.lineCount} poz. ·{" "}
                        {STATUS_LABEL[p.status]}
                        {p.decisionNote ? <span className="text-slate-500"> - {p.decisionNote}</span> : null}
                      </span>
                      {d ? (
                        <span className="shrink-0 text-xs tabular-nums text-slate-600">
                          bez zmian {d.same} · zmienione {d.changed} · usunięte {d.removed} · dodane {d.added}
                        </span>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            </section>
          ) : null}
        </ModalShell>
      ) : null}

      {accepting ? (
        <ZdAutoProposalAcceptDialog
          supplierId={supplierId}
          supplierName={supplierName}
          morning={latest}
          onClose={() => {
            setAccepting(false);
            load();
          }}
        />
      ) : null}

      {rejecting ? (
        <ModalShell
          open
          onClose={() => setRejecting(false)}
          title="Odrzuć propozycję"
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
          <label htmlFor={noteId} className="text-sm font-medium text-slate-800">
            Dlaczego? (np. „za dużo gipsu”, „Polkard ma przestój”)
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
