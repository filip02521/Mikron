"use client";

import { useEffect, useId, useState } from "react";
import { BrandLoader } from "@/components/ui/BrandLoader";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/cn";
import {
  actionClearServiceOrderInvoice,
  actionServiceClientInvoices,
  actionSetServiceOrderInvoice,
  actionSetServiceOrderNoInvoice,
  actionSetServiceOrderRw,
  type ClientInvoicesActionResult,
  type ServiceOrderActionResult,
} from "@/app/actions/service-orders";
import { pickerInputClass } from "@/components/serwis/SubiektPickers";
import { formatDateOnly, formatDay, type OrderPartView } from "@/components/serwis/service-order-view";
import {
  canSetServiceOrderInvoice,
  canSetServiceOrderRw,
  isClosedServiceOrder,
  missingDocsText,
  missingServiceOrderDocs,
  rwClipboardText,
  rwLines,
  SERVICE_ORDER_TEXT_MAX,
  type ServiceOrder,
} from "@/lib/orders/service-orders";

type Submit = (fn: () => Promise<ServiceOrderActionResult>, after?: () => void) => void;

const money = (n: number | null) =>
  n == null ? "" : `${n.toLocaleString("pl-PL", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} zł`;

/** Faktury klienta z 90 dni — klik wskazuje fakturę za naprawę. */
function ClientInvoiceList({ khId, onPick, disabled }: { khId: number; onPick: (id: number, number: string) => void; disabled: boolean }) {
  const [res, setRes] = useState<ClientInvoicesActionResult | null>(null);
  useEffect(() => {
    let alive = true;
    actionServiceClientInvoices(khId).then(
      (r) => alive && setRes(r),
      () => alive && setRes({ ok: false, message: "Nie udało się pobrać faktur klienta z Subiekta." })
    );
    return () => {
      alive = false;
    };
  }, [khId]);

  if (!res) {
    return (
      <div role="status" className="flex items-center gap-3 py-1">
        <BrandLoader size="sm" tile={false} />
        <span className="text-[0.8125rem] text-slate-600">Pobieram faktury klienta z Subiekta…</span>
      </div>
    );
  }
  if (!res.ok) return <p className="text-[0.8125rem] text-amber-900">{res.message} Wpisz numer niżej.</p>;
  if (!res.invoices.length) return <p className="text-[0.8125rem] text-slate-600">Klient nie ma faktur z ostatnich 90 dni — wpisz numer niżej.</p>;
  return (
    <ul aria-label="Faktury klienta z 90 dni" className="divide-y divide-slate-100 rounded-xl border border-slate-200 bg-card">
      {res.invoices.slice(0, 6).map((f) => (
        <li key={f.id}>
          <button
            type="button"
            disabled={disabled}
            onClick={() => onPick(f.id, f.number)}
            className="flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors duration-150 hover:bg-slate-50 disabled:opacity-50"
          >
            <span className="min-w-0 flex-1 font-mono text-sm text-slate-900">{f.number}</span>
            <span className="text-[0.8125rem] tabular-nums text-slate-500">{f.date ? formatDateOnly(f.date) : ""}</span>
            <span className="w-24 text-right text-[0.8125rem] tabular-nums text-slate-700">{money(f.gross)}</span>
          </button>
        </li>
      ))}
    </ul>
  );
}

/**
 * Dokumenty przy wydaniu: faktura za naprawę (z listy klienta, wpisana albo „bez faktury”) i RW na części.
 * Braki tylko ostrzegają — zlecenie zostaje wtedy na liście „Brak dokumentów”.
 */
export function ServiceOrderDocuments({
  order,
  parts,
  pending,
  submit,
}: {
  order: ServiceOrder;
  parts: OrderPartView[];
  pending: boolean;
  submit: Submit;
}) {
  const formId = useId();
  const [fsNumber, setFsNumber] = useState("");
  const [noInvoice, setNoInvoice] = useState(false);
  const [reason, setReason] = useState("");
  const [rw, setRw] = useState("");
  const [copied, setCopied] = useState(false);
  const closed = isClosedServiceOrder(order.status);
  const missing = missingServiceOrderDocs(order, parts);
  const missingText = missingDocsText(missing);
  const lines = rwLines(parts);

  return (
    <section aria-labelledby={`${formId}-docs`} className="space-y-3">
      <h3 id={`${formId}-docs`} className="text-[0.8125rem] font-semibold text-slate-600">
        Dokumenty
      </h3>
      {closed && missingText ? (
        <p className="rounded-lg bg-amber-50 px-3 py-2 text-[0.8125rem] text-amber-900">
          {missingText} — zlecenie jest na liście „Brak dokumentów”.
        </p>
      ) : null}

      {canSetServiceOrderInvoice(order.status) ? (
        <div className="space-y-2.5 rounded-xl border border-slate-200 p-4">
          <div className="text-sm font-semibold text-slate-900">Faktura za naprawę</div>
          {order.fsNumber || order.noInvoiceReason ? (
            <div className="flex flex-wrap items-center gap-2">
              <span className="min-w-0 flex-1 text-sm text-slate-800">
                {order.fsNumber ? <span className="font-mono">{order.fsNumber}</span> : <>Bez faktury: {order.noInvoiceReason}</>}
              </span>
              <Button
                type="button"
                variant="secondary"
                disabled={pending}
                onClick={() => submit(() => actionClearServiceOrderInvoice({ orderId: order.id }))}
              >
                Zmień
              </Button>
            </div>
          ) : noInvoice ? (
            <form
              className="space-y-2"
              onSubmit={(e) => {
                e.preventDefault();
                submit(() => actionSetServiceOrderNoInvoice({ orderId: order.id, reason }), () => setNoInvoice(false));
              }}
            >
              <label htmlFor={`${formId}-reason`} className="block text-xs font-semibold text-slate-600">
                Dlaczego bez faktury
              </label>
              <input
                id={`${formId}-reason`}
                value={reason}
                maxLength={200}
                autoFocus
                onChange={(e) => setReason(e.target.value)}
                placeholder="Np. naprawa gwarancyjna, bezpłatna poprawka"
                className={pickerInputClass}
              />
              <div className="grid grid-cols-2 gap-2">
                <Button type="button" variant="secondary" onClick={() => setNoInvoice(false)} disabled={pending}>
                  Wróć
                </Button>
                <Button type="submit" disabled={pending || !reason.trim()}>
                  Zapisz bez faktury
                </Button>
              </div>
            </form>
          ) : (
            <>
              {order.clientKhId ? (
                <ClientInvoiceList
                  khId={order.clientKhId}
                  disabled={pending}
                  onPick={(id, number) => submit(() => actionSetServiceOrderInvoice({ orderId: order.id, fsId: id, fsNumber: number }))}
                />
              ) : (
                <p className="text-[0.8125rem] text-slate-600">Klient spoza Subiekta — wpisz numer faktury.</p>
              )}
              <form
                className="flex flex-wrap items-end gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  submit(() => actionSetServiceOrderInvoice({ orderId: order.id, fsNumber }), () => setFsNumber(""));
                }}
              >
                <div className="min-w-0 flex-1">
                  <label htmlFor={`${formId}-fs`} className="mb-1.5 block text-xs font-semibold text-slate-600">
                    {order.clientKhId ? "Albo numer faktury" : "Numer faktury"}
                  </label>
                  <input
                    id={`${formId}-fs`}
                    value={fsNumber}
                    maxLength={60}
                    onChange={(e) => setFsNumber(e.target.value)}
                    placeholder="Np. FS 2362/M/10/2026"
                    className={`${pickerInputClass} font-mono`}
                  />
                </div>
                <Button type="submit" disabled={pending || !fsNumber.trim()}>
                  Zapisz
                </Button>
              </form>
              <Button type="button" variant="secondary" className="w-full" onClick={() => setNoInvoice(true)} disabled={pending}>
                Bez faktury (gwarancja, bezpłatna)
              </Button>
            </>
          )}
        </div>
      ) : null}

      {order.rwNumber ? (
        <div className="rounded-xl border border-slate-200 p-4">
          <div className="text-sm font-semibold text-slate-900">RW na części</div>
          <p className="text-sm text-slate-800">
            <span className="font-mono">{order.rwNumber}</span>
            {order.rwAt ? <span className="text-slate-500"> · wpisane {formatDay(order.rwAt)}</span> : null}
          </p>
        </div>
      ) : missing.rw ? (
        <div className={cn("space-y-3 rounded-xl border p-4", closed ? "border-amber-200" : "border-slate-200")}>
          <div className="text-sm font-semibold text-slate-900">RW na części</div>
          <p className="text-[0.8125rem] text-slate-600">Wystaw w Subiekcie RW z tymi pozycjami i wpisz tu jego numer.</p>
          <ul className="space-y-1">
            {lines.map((l) => (
              <li key={l.partTwId} className="flex gap-3 text-sm">
                <span className="w-12 flex-none text-right font-semibold tabular-nums">{l.quantity}</span>
                <span className="min-w-0 flex-1">
                  <span className="font-mono">{l.partSymbol ?? "—"}</span> <span className="text-slate-600">{l.partName}</span>
                </span>
              </li>
            ))}
          </ul>
          <Button
            type="button"
            variant="secondary"
            className="w-full"
            onClick={() =>
              navigator.clipboard?.writeText(rwClipboardText(lines)).then(
                () => setCopied(true),
                () => setCopied(false)
              )
            }
          >
            {copied ? "Skopiowano pozycje" : "Kopiuj pozycje (symbol, ilość)"}
          </Button>
          {canSetServiceOrderRw(order.status) ? (
            <form
              className="flex flex-wrap items-end gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                submit(() => actionSetServiceOrderRw({ orderId: order.id, rwNumber: rw }), () => setRw(""));
              }}
            >
              <div className="min-w-0 flex-1">
                <label htmlFor={`${formId}-rw`} className="mb-1.5 block text-xs font-semibold text-slate-600">
                  Numer RW z Subiekta
                </label>
                <input
                  id={`${formId}-rw`}
                  value={rw}
                  maxLength={SERVICE_ORDER_TEXT_MAX.rw}
                  onChange={(e) => setRw(e.target.value)}
                  placeholder="Np. RW 15/MAG/2026"
                  className={`${pickerInputClass} font-mono`}
                />
              </div>
              <Button type="submit" disabled={pending || !rw.trim()}>
                Zapisz RW
              </Button>
            </form>
          ) : null}
        </div>
      ) : parts.length === 0 && order.status !== "anulowane" ? (
        <p className="text-[0.8125rem] text-slate-500">Bez pobranych części — RW nie jest potrzebne.</p>
      ) : null}
    </section>
  );
}
