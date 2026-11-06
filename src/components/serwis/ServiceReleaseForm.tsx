"use client";

import { useId, useState } from "react";
import { Button } from "@/components/ui/Button";
import { IconPackageCheck } from "@/components/icons/StrokeIcons";
import { cn } from "@/lib/cn";
import { actionMoveServiceOrder, type ServiceOrderActionResult } from "@/app/actions/service-orders";
import { pickerInputClass } from "@/components/serwis/SubiektPickers";
import { ClientMessage } from "@/components/serwis/ServiceQuoteForm";
import type { OrderPartView } from "@/components/serwis/service-order-view";
import { composeReleaseMessage } from "@/lib/orders/service-messages";
import { SERVICE_OUTBOUND_LABEL, type ServiceOrder, type ServiceOutboundMethod } from "@/lib/orders/service-orders";
import { fieldLabelClass, fieldLabelInlineClass } from "@/lib/ui/serwis-theme";

type Submit = (fn: () => Promise<ServiceOrderActionResult>, after?: () => void) => void;

const METHODS = Object.keys(SERVICE_OUTBOUND_LABEL) as ServiceOutboundMethod[];

/** Wydanie sprzętu: jak wraca do klienta (kurier z numerem przesyłki albo odbiór osobisty) i wiadomość o wydaniu. */
export function ServiceReleaseForm({
  order,
  parts,
  hint,
  pending,
  submit,
  onCancel,
}: {
  order: ServiceOrder;
  parts: OrderPartView[];
  /** Zdanie skutku wydania (braki w dokumentach, zamiennik do odebrania). */
  hint: string | null;
  pending: boolean;
  submit: Submit;
  onCancel: () => void;
}) {
  const formId = useId();
  const [method, setMethod] = useState<ServiceOutboundMethod | null>(null);
  const [tracking, setTracking] = useState("");
  const [address, setAddress] = useState("");
  const courier = method === "gls" || method === "inny_kurier";
  const message = composeReleaseMessage({
    items: [{ deviceName: order.deviceName, serialNo: order.serialNo, parts }],
    rejected: order.quote.decision === "rejected",
    fsNumber: order.fsNumber,
    noInvoiceReason: order.noInvoiceReason,
    // Koszt tylko z wyceny, którą klient przyjął — wycofana albo bez decyzji nie trafia do wiadomości.
    amount: order.quote.decision === "accepted" ? order.quote.amount : null,
    method,
    tracking: courier ? tracking : null,
  });

  return (
    <form
      aria-labelledby={`${formId}-title`}
      className="space-y-3 rounded-xl border border-[var(--sv-rule)] bg-[var(--sv-box)] p-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (!method) return;
        submit(() =>
          actionMoveServiceOrder({
            orderId: order.id,
            to: "wydane",
            note: "",
            outbound: { method, tracking: courier ? tracking : null, address: courier ? address : null },
          })
        );
      }}
    >
      <div id={`${formId}-title`} className="text-sm font-semibold text-slate-900">
        Jak sprzęt wraca do klienta?
      </div>
      <div role="radiogroup" aria-labelledby={`${formId}-title`} className="grid gap-2 sm:grid-cols-3">
        {METHODS.map((m) => (
          <button
            key={m}
            type="button"
            role="radio"
            aria-checked={method === m}
            onClick={() => setMethod(m)}
            className={cn(
              "inline-flex min-h-11 items-center justify-center rounded-lg border px-3 py-1.5 text-sm transition-colors duration-150",
              method === m ? "border-indigo-600 bg-indigo-50 font-semibold text-indigo-900" : "border-slate-200 bg-card text-slate-700 hover:bg-slate-100"
            )}
          >
            {SERVICE_OUTBOUND_LABEL[m]}
          </button>
        ))}
      </div>
      {courier ? (
        <>
          <div>
            <label htmlFor={`${formId}-tracking`} className={fieldLabelClass}>
              Numer przesyłki
            </label>
            <input
              id={`${formId}-tracking`}
              value={tracking}
              maxLength={60}
              autoComplete="off"
              onChange={(e) => setTracking(e.target.value)}
              className={cn(pickerInputClass, "font-mono")}
            />
          </div>
          <div>
            <label htmlFor={`${formId}-address`} className={fieldLabelInlineClass}>
              Adres wysyłki
            </label>
            <p className="mb-1.5 text-[0.8125rem] text-slate-500">Tylko gdy inny niż w Subiekcie.</p>
            <textarea
              id={`${formId}-address`}
              value={address}
              rows={2}
              maxLength={300}
              onChange={(e) => setAddress(e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-card px-3 py-2 text-base focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 sm:text-sm"
            />
          </div>
        </>
      ) : null}
      <div className="grid grid-cols-2 gap-2">
        <Button type="button" variant="secondary" className="min-h-11" onClick={onCancel} disabled={pending}>
          Wróć
        </Button>
        <Button type="submit" className="min-h-11" disabled={pending || !method}>
          <IconPackageCheck size={18} aria-hidden className="shrink-0" />
          Wydaj klientowi
        </Button>
      </div>
      <p className="text-[0.8125rem] text-slate-600">{method ? hint : "Wybierz, jak sprzęt wraca, żeby go wydać."}</p>
      <ClientMessage text={message} label="Kopiuj wiadomość o wydaniu" />
    </form>
  );
}
