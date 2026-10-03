"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/cn";
import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { DataTable, TableScroll } from "@/components/ui/DataTable";
import { EmptyState } from "@/components/ui/EmptyState";
import { Spinner } from "@/components/ui/Spinner";
import { IconChevronLeft, IconDownload, IconTrash2 } from "@/components/icons/StrokeIcons";
import {
  actionAddDraftLine,
  actionCancelDraft,
  actionRemoveDraftLine,
  actionSetDraftLineQty,
  actionSetDraftNote,
  actionSubmitDraftAsZd,
} from "@/app/actions/stock-watch";
import { purchaseDraftTotals, type PurchaseDraft } from "@/lib/stock-watch/drafts-shared";
import { formatPln, formatQtyPl } from "@/components/stock-watch/stock-watch-format";

type AddableItem = {
  subiektTwId: number;
  twSymbol: string | null;
  twNazwa: string;
  suggestedQty: number;
  status: string;
};

function csvCell(value: string | number | null): string {
  const s = value == null ? "" : String(value);
  return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function PurchaseDraftEditor({
  draft,
  addable,
  canMutate,
  host,
}: {
  draft: PurchaseDraft;
  addable: AddableItem[];
  canMutate: boolean;
  host: { configured: boolean; isLive: boolean; label: string };
}) {
  const router = useRouter();
  const editable = canMutate && draft.status === "draft";
  const [qtyByTw, setQtyByTw] = useState<Record<number, string>>(() =>
    Object.fromEntries(draft.lines.map((l) => [l.subiektTwId, String(l.qty)]))
  );
  const [note, setNote] = useState(draft.note);
  const [addTw, setAddTw] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [savingTw, setSavingTw] = useState<number | null>(null);
  const [confirmSubmit, setConfirmSubmit] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [created, setCreated] = useState<{ dokNr: string | null } | null>(null);
  const [pending, startTransition] = useTransition();

  const lines = useMemo(
    () =>
      draft.lines.map((l) => {
        const typed = Number(qtyByTw[l.subiektTwId]);
        return { ...l, qty: Number.isFinite(typed) && typed > 0 ? typed : l.qty };
      }),
    [draft.lines, qtyByTw]
  );
  const totals = purchaseDraftTotals(lines);

  const saveQty = (twId: number) => {
    const raw = qtyByTw[twId];
    const qty = Math.ceil(Number(raw));
    const original = draft.lines.find((l) => l.subiektTwId === twId);
    if (!original || qty === original.qty) return;
    if (!Number.isFinite(qty) || qty <= 0) {
      setError("Ilość musi być większa od 0 — żeby usunąć pozycję, użyj kosza.");
      setQtyByTw((p) => ({ ...p, [twId]: String(original.qty) }));
      return;
    }
    setSavingTw(twId);
    startTransition(async () => {
      const res = await actionSetDraftLineQty({ draftId: draft.id, subiektTwId: twId, qty });
      setSavingTw(null);
      if (!res.ok) {
        setError(res.message);
        setQtyByTw((p) => ({ ...p, [twId]: String(original.qty) }));
        return;
      }
      setQtyByTw((p) => ({ ...p, [twId]: String(qty) }));
      router.refresh();
    });
  };

  const run = (fn: () => Promise<{ ok: boolean; message?: string }>, after?: () => void) => {
    setError(null);
    startTransition(async () => {
      const res = await fn();
      if (!res.ok) {
        setError(res.message ?? "Nie udało się.");
        return;
      }
      after?.();
      router.refresh();
    });
  };

  const exportCsv = () => {
    const header = ["Symbol", "Nazwa", "Ilość (szt)", "Cena netto/szt", "Wartość netto"];
    const rows = lines.map((l) => [
      l.twSymbol ?? "",
      l.twNazwa,
      l.qty,
      l.unitPriceNet != null ? l.unitPriceNet.toFixed(2).replace(".", ",") : "",
      l.unitPriceNet != null ? (l.qty * l.unitPriceNet).toFixed(2).replace(".", ",") : "",
    ]);
    const csv = [header, ...rows].map((r) => r.map(csvCell).join(";")).join("\n");
    const blob = new Blob([`﻿${csv}`], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `zamowienie-${draft.supplierName.replace(/[^\p{L}\p{N}]+/gu, "-")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const submit = () => {
    setError(null);
    startTransition(async () => {
      const res = await actionSubmitDraftAsZd({ draftId: draft.id, uwagi: note });
      setConfirmSubmit(false);
      if (!res.ok) {
        setError(res.message);
        return;
      }
      setCreated({ dokNr: res.data.dokNr });
      router.refresh();
    });
  };

  return (
    <div className="space-y-4">
      <div className="print:hidden">
        <Link
          href="/zakupy/braki"
          className="inline-flex items-center gap-1 text-sm font-medium text-slate-600 hover:text-slate-900"
        >
          <IconChevronLeft size={16} strokeWidth={2} />
          Braki i zamówienia
        </Link>
      </div>

      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Szkic zamówienia</p>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">{draft.supplierName}</h1>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-slate-600">
            {draft.status === "draft" ? (
              <Badge variant="warning">Szkic — do edycji</Badge>
            ) : draft.status === "submitted" ? (
              <Badge variant="success">Utworzono {draft.zdDokNr ?? "ZD"}</Badge>
            ) : (
              <Badge>Anulowany</Badge>
            )}
            <span>{lines.length} pozycji</span>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 print:hidden">
          <Button variant="secondary" size="sm" onClick={exportCsv} disabled={!lines.length}>
            <IconDownload size={15} strokeWidth={2} className="mr-1.5" />
            CSV
          </Button>
          <Button variant="secondary" size="sm" onClick={() => window.print()} disabled={!lines.length}>
            Drukuj / PDF
          </Button>
          {editable ? (
            <Button variant="ghost" size="sm" onClick={() => setConfirmCancel(true)} disabled={pending}>
              Anuluj szkic
            </Button>
          ) : null}
        </div>
      </header>

      {created || draft.status === "submitted" ? (
        <Alert tone="success" title={`Utworzono ZD ${created?.dokNr ?? draft.zdDokNr ?? ""}`}>
          Dokument jest w Subiekcie. Rotacja i propozycje uwzględnią go przy najbliższej analizie (otwarte ZD).
        </Alert>
      ) : null}
      {error ? (
        <Alert tone="error" title="Nie udało się">
          {error}
        </Alert>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-[1fr_18rem]">
        <Card padding={false} className="overflow-hidden">
          {lines.length === 0 ? (
            <EmptyState
              title="Szkic jest pusty"
              description="Dodaj towary dostawcy z listy poniżej albo wróć do panelu."
            />
          ) : (
            <TableScroll className="sm:px-0 sm:pb-0">
              <DataTable className="min-w-[560px]">
                <thead>
                  <tr>
                    <th scope="col">Towar</th>
                    <th scope="col" className="text-right" title="Propozycja z analizy (szt)">Prop.</th>
                    <th scope="col" className="text-right">Ilość (szt)</th>
                    <th scope="col" className="text-right">Cena netto</th>
                    <th scope="col" className="text-right">Wartość</th>
                    {editable ? <th scope="col" className="print:hidden"><span className="sr-only">Usuń</span></th> : null}
                  </tr>
                </thead>
                <tbody>
                  {lines.map((line) => {
                    const changed = line.qty !== line.suggestedQty;
                    return (
                      <tr key={line.subiektTwId}>
                        <td>
                          <p className="font-mono text-[13px] font-semibold text-slate-900">{line.twSymbol ?? "—"}</p>
                          <p className="max-w-[14rem] truncate text-xs text-slate-500 xl:max-w-[22rem]" title={line.twNazwa}>
                            {line.twNazwa}
                          </p>
                        </td>
                        <td className="text-right tabular-nums text-sm text-slate-500">
                          {line.suggestedQty > 0 ? formatQtyPl(line.suggestedQty) : "—"}
                        </td>
                        <td className="text-right">
                          {editable ? (
                            <div className="inline-flex items-center gap-1.5">
                              {savingTw === line.subiektTwId ? <Spinner size="sm" /> : null}
                              <input
                                type="number"
                                inputMode="numeric"
                                min={1}
                                step={1}
                                value={qtyByTw[line.subiektTwId] ?? ""}
                                onChange={(e) =>
                                  setQtyByTw((p) => ({ ...p, [line.subiektTwId]: e.target.value }))
                                }
                                onBlur={() => saveQty(line.subiektTwId)}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                                }}
                                aria-label={`Ilość ${line.twSymbol ?? line.twNazwa}`}
                                className={cn(
                                  "h-9 w-24 rounded-md border bg-white px-2 text-right text-sm tabular-nums outline-none focus:ring-2 focus:ring-indigo-200",
                                  changed ? "border-indigo-300 bg-indigo-50/40" : "border-slate-200"
                                )}
                              />
                            </div>
                          ) : (
                            <span className="font-semibold tabular-nums">{formatQtyPl(line.qty)}</span>
                          )}
                        </td>
                        <td className="text-right tabular-nums text-sm">
                          {line.unitPriceNet != null ? (
                            formatPln(line.unitPriceNet)
                          ) : (
                            <span className="text-slate-400">brak</span>
                          )}
                        </td>
                        <td className="text-right font-medium tabular-nums">
                          {line.unitPriceNet != null ? formatPln(line.qty * line.unitPriceNet) : "—"}
                        </td>
                        {editable ? (
                          <td className="text-right print:hidden">
                            <button
                              type="button"
                              onClick={() =>
                                run(() =>
                                  actionRemoveDraftLine({ draftId: draft.id, subiektTwId: line.subiektTwId })
                                )
                              }
                              disabled={pending}
                              className="rounded-md p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-700"
                              aria-label={`Usuń ${line.twSymbol ?? line.twNazwa}`}
                              title="Usuń pozycję ze szkicu"
                            >
                              <IconTrash2 size={16} strokeWidth={2} />
                            </button>
                          </td>
                        ) : null}
                      </tr>
                    );
                  })}
                </tbody>
              </DataTable>
            </TableScroll>
          )}

          {editable && addable.length > 0 ? (
            <div className="flex flex-col gap-2 border-t border-slate-100 p-4 sm:flex-row sm:items-center print:hidden">
              <label className="min-w-0 flex-1">
                <span className="sr-only">Dodaj towar dostawcy</span>
                <select
                  value={addTw}
                  onChange={(e) => setAddTw(e.target.value)}
                  className="h-10 w-full rounded-md border border-slate-200 bg-white px-2 text-sm"
                >
                  <option value="">Dodaj towar tego dostawcy…</option>
                  {addable.map((a) => (
                    <option key={a.subiektTwId} value={a.subiektTwId}>
                      {a.twSymbol ?? "—"} · {a.twNazwa}
                      {a.suggestedQty > 0 ? ` (propozycja ${formatQtyPl(a.suggestedQty)})` : ""}
                    </option>
                  ))}
                </select>
              </label>
              <Button
                variant="secondary"
                size="sm"
                disabled={!addTw || pending}
                onClick={() =>
                  run(
                    () => actionAddDraftLine({ draftId: draft.id, subiektTwId: Number(addTw) }),
                    () => setAddTw("")
                  )
                }
              >
                Dodaj
              </Button>
            </div>
          ) : null}
        </Card>

        <aside className="space-y-4">
          <Card padding={false} className="p-4 lg:sticky lg:top-4">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Wartość netto</p>
            <p className="mt-0.5 text-2xl font-semibold tabular-nums text-slate-900">
              {formatPln(totals.totalValue)}
            </p>
            {totals.pricedLineCount < lines.length ? (
              <p className="mt-0.5 text-xs text-amber-800">
                {lines.length - totals.pricedLineCount} poz. bez ceny z ZD — poza sumą
              </p>
            ) : null}
            <label className="mt-4 block">
              <span className="text-xs font-medium text-slate-600">Uwagi do ZD</span>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                onBlur={() => {
                  if (editable && note !== draft.note) {
                    run(() => actionSetDraftNote({ draftId: draft.id, note }));
                  }
                }}
                disabled={!editable}
                rows={3}
                maxLength={1000}
                placeholder="Domyślnie: Braki i zamówienia — data"
                className="mt-1 w-full rounded-md border border-slate-200 bg-white px-2.5 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-200 disabled:bg-slate-50"
              />
            </label>
            {editable ? (
              <div className="mt-3 print:hidden">
                <Button
                  className="w-full"
                  onClick={() => setConfirmSubmit(true)}
                  disabled={pending || !lines.length || !host.configured}
                >
                  Utwórz ZD w Subiekcie
                </Button>
                <p className="mt-1.5 text-[11px] leading-snug text-slate-500">
                  {host.configured
                    ? `${host.isLive ? "Baza LIVE" : "Baza testowa"}: ${host.label}. Ilości w sztukach zostaną przeliczone na opakowania z kreatora ZD.`
                    : host.label}
                </p>
              </div>
            ) : null}
          </Card>
        </aside>
      </div>

      <ConfirmDialog
        open={confirmSubmit}
        title={host.isLive ? "Utworzyć ZD w bazie LIVE?" : "Utworzyć ZD w bazie testowej?"}
        message={`Powstanie zamówienie do dostawcy ${draft.supplierName} w Subiekcie (${host.label}) z ${lines.length} pozycjami. Tej operacji nie da się cofnąć z OnTime.`}
        summary={`Wartość netto: ${formatPln(totals.totalValue)}`}
        confirmLabel="Utwórz ZD"
        cancelLabel="Wróć"
        pending={pending}
        onCancel={() => setConfirmSubmit(false)}
        onConfirm={submit}
      />
      <ConfirmDialog
        open={confirmCancel}
        title="Anulować szkic?"
        message="Szkic zostanie zamknięty. „Przygotuj zamówienie” utworzy nowy z aktualnych propozycji."
        confirmLabel="Anuluj szkic"
        cancelLabel="Wróć"
        danger
        pending={pending}
        onCancel={() => setConfirmCancel(false)}
        onConfirm={() =>
          run(
            () => actionCancelDraft(draft.id),
            () => {
              setConfirmCancel(false);
              router.push("/zakupy/braki");
            }
          )
        }
      />
      {pending && !savingTw ? (
        <div className="sr-only" role="status">
          Zapisuję…
        </div>
      ) : null}
    </div>
  );
}
