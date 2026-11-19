"use client";

import { useEffect, useId, useRef, useState } from "react";
import { BrandLoader } from "@/components/ui/BrandLoader";
import { Button } from "@/components/ui/Button";
import { IconCopy } from "@/components/icons/StrokeIcons";
import { warrantyStatus } from "@/lib/orders/service-warranty";
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
  missingServiceOrderDocs,
  rwClipboardText,
  rwLines,
  SERVICE_ORDER_TEXT_MAX,
  type ServiceOrder,
} from "@/lib/orders/service-orders";

type Submit = (fn: () => Promise<ServiceOrderActionResult>, after?: () => void) => void;

const money = (n: number | null) =>
  n == null ? "" : `${n.toLocaleString("pl-PL", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} zł`;

/** Nagłówek karty dokumentu; po zamknięciu brak jest w nim, nie w osobnym komunikacie. */
function DocTitle({ children, missing }: { children: string; missing: boolean }) {
  return (
    <div className="text-sm font-semibold text-slate-900">
      {children}
      {missing ? <span className="font-semibold text-amber-800"> · brak</span> : null}
    </div>
  );
}

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
  // Przyciski „Zapisz” są aktywne także przy pustym polu: klik mówi, czego brakuje, zamiast milczeć.
  const [emptyHint, setEmptyHint] = useState<"fs" | "rw" | "reason" | null>(null);
  const fsRef = useRef<HTMLInputElement>(null);
  const rwRef = useRef<HTMLInputElement>(null);
  const reasonRef = useRef<HTMLInputElement>(null);
  const closed = isClosedServiceOrder(order.status);
  const missing = missingServiceOrderDocs(order, parts);
  const lines = rwLines(parts);
  // Przyjęte na gwarancji: naprawa zwykle bez faktury — powód podpowiadamy, decyzja zostaje u serwisanta.
  const underWarranty = warrantyStatus(order.warrantyUntil, new Date(order.createdAt)).state === "active";
  const requireValue = (value: string, field: "fs" | "rw" | "reason", ref: React.RefObject<HTMLInputElement | null>) => {
    if (value.trim()) return true;
    setEmptyHint(field);
    ref.current?.focus();
    return false;
  };
  const hint = (field: "fs" | "rw" | "reason", text: string) =>
    emptyHint === field ? <p className="basis-full text-[0.8125rem] text-amber-900">{text}</p> : null;

  return (
    <section aria-labelledby={`${formId}-docs`} className="space-y-3">
      <h3 id={`${formId}-docs`} className="text-[0.8125rem] font-semibold text-slate-600">
        Dokumenty
      </h3>

      {canSetServiceOrderInvoice(order.status) ? (
        <div className={cn("space-y-2.5 rounded-xl border p-4", closed && missing.invoice ? "border-amber-300 bg-amber-50/40" : "border-slate-200")}>
          <DocTitle missing={closed && missing.invoice}>Faktura za naprawę</DocTitle>
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
                if (!requireValue(reason, "reason", reasonRef)) return;
                submit(() => actionSetServiceOrderNoInvoice({ orderId: order.id, reason }), () => setNoInvoice(false));
              }}
            >
              <label htmlFor={`${formId}-reason`} className="block text-xs font-semibold text-slate-600">
                Dlaczego bez faktury
              </label>
              <input
                id={`${formId}-reason`}
                ref={reasonRef}
                value={reason}
                maxLength={200}
                autoFocus
                onChange={(e) => {
                  setReason(e.target.value);
                  setEmptyHint(null);
                }}
                placeholder="Np. naprawa gwarancyjna, bezpłatna poprawka"
                className={pickerInputClass}
              />
              {hint("reason", "Wpisz, dlaczego naprawa jest bez faktury.")}
              <div className="grid grid-cols-2 gap-2">
                <Button type="button" variant="secondary" onClick={() => setNoInvoice(false)} disabled={pending}>
                  Wróć
                </Button>
                <Button type="submit" disabled={pending}>
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
                  if (!requireValue(fsNumber, "fs", fsRef)) return;
                  submit(() => actionSetServiceOrderInvoice({ orderId: order.id, fsNumber }), () => setFsNumber(""));
                }}
              >
                <div className="min-w-0 flex-1">
                  <label htmlFor={`${formId}-fs`} className="mb-1.5 block text-xs font-semibold text-slate-600">
                    {order.clientKhId ? "Albo numer faktury" : "Numer faktury"}
                  </label>
                  <input
                    id={`${formId}-fs`}
                    ref={fsRef}
                    value={fsNumber}
                    maxLength={60}
                    onChange={(e) => {
                      setFsNumber(e.target.value);
                      setEmptyHint(null);
                    }}
                    placeholder="Np. FS 2362/M/10/2026"
                    className={`${pickerInputClass} font-mono`}
                  />
                </div>
                <Button type="submit" disabled={pending}>
                  Zapisz
                </Button>
                {hint("fs", "Wpisz numer faktury z Subiekta.")}
              </form>
              <Button
                type="button"
                variant="secondary"
                className="w-full"
                onClick={() => {
                  if (underWarranty && !reason.trim()) setReason("naprawa gwarancyjna");
                  setNoInvoice(true);
                }}
                disabled={pending}
              >
                Bez faktury (gwarancja, bezpłatna)
              </Button>
              {underWarranty ? (
                <p className="text-[0.8125rem] text-emerald-800">Sprzęt przyjęty na gwarancji — naprawę gwarancyjną zapisz bez faktury.</p>
              ) : null}
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
        <div className={cn("space-y-3 rounded-xl border p-4", closed ? "border-amber-300 bg-amber-50/40" : "border-slate-200")}>
          <DocTitle missing={closed}>RW na części</DocTitle>
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
            <IconCopy size={18} aria-hidden />
            {copied ? "Skopiowano pozycje" : "Kopiuj pozycje (symbol, ilość)"}
          </Button>
          {canSetServiceOrderRw(order.status) ? (
            <form
              className="flex flex-wrap items-end gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                if (!requireValue(rw, "rw", rwRef)) return;
                submit(() => actionSetServiceOrderRw({ orderId: order.id, rwNumber: rw }), () => setRw(""));
              }}
            >
              <div className="min-w-0 flex-1">
                <label htmlFor={`${formId}-rw`} className="mb-1.5 block text-xs font-semibold text-slate-600">
                  Numer RW z Subiekta
                </label>
                <input
                  id={`${formId}-rw`}
                  ref={rwRef}
                  value={rw}
                  maxLength={SERVICE_ORDER_TEXT_MAX.rw}
                  onChange={(e) => {
                    setRw(e.target.value);
                    setEmptyHint(null);
                  }}
                  placeholder="Np. RW 15/MAG/2026"
                  className={`${pickerInputClass} font-mono`}
                />
              </div>
              <Button type="submit" disabled={pending}>
                Zapisz RW
              </Button>
              {hint("rw", "Wpisz numer RW z Subiekta.")}
            </form>
          ) : null}
        </div>
      ) : parts.length === 0 && order.status !== "anulowane" ? (
        <p className="text-[0.8125rem] text-slate-500">Bez pobranych części — RW nie jest potrzebne.</p>
      ) : null}
    </section>
  );
}
