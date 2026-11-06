"use client";

import { useId, useState } from "react";
import { Button } from "@/components/ui/Button";
import { IconCopy } from "@/components/icons/StrokeIcons";
import { cn } from "@/lib/cn";
import { copyTextToClipboard } from "@/lib/ui/copy-text-to-clipboard";
import { actionSendServiceQuote, type ServiceOrderActionResult } from "@/app/actions/service-orders";
import { pickerInputClass } from "@/components/serwis/SubiektPickers";
import type { OrderPartView } from "@/components/serwis/service-order-view";
import { composeQuoteMessage, defaultQuoteScope } from "@/lib/orders/service-messages";
import { formatQuoteAmount, parseQuoteAmount, type ServiceOrder } from "@/lib/orders/service-orders";
import { fieldLabelClass } from "@/lib/ui/serwis-theme";

type Submit = (fn: () => Promise<ServiceOrderActionResult>, after?: () => void) => void;

/** Podgląd wiadomości i kopiowanie do schowka — OnTime nie pisze do helpdesku, serwisant wkleja tekst w zgłoszenie. */
export function ClientMessage({ text, label, disabledHint }: { text: string | null; label: string; disabledHint?: string }) {
  const [copied, setCopied] = useState<boolean | null>(null);
  return (
    <div className="space-y-2">
      {text ? (
        <pre className="max-h-56 overflow-y-auto whitespace-pre-wrap rounded-lg border border-[var(--sv-rule)] bg-card px-3 py-2 font-sans text-[0.8125rem] text-slate-800">
          {text}
        </pre>
      ) : null}
      <Button
        type="button"
        variant="secondary"
        disabled={!text}
        className="min-h-11 w-full"
        onClick={() => text && copyTextToClipboard(text).then(setCopied)}
      >
        <IconCopy size={18} aria-hidden />
        {copied ? "Skopiowano — wklej w zgłoszenie" : label}
      </Button>
      <p className="text-[0.8125rem] text-slate-600" aria-live="polite">
        {copied === false
          ? "Nie udało się skopiować — zaznacz tekst wyżej i skopiuj ręcznie."
          : !text && disabledHint
            ? disabledHint
            : "Do wklejenia w zgłoszenie w helpdesku — OnTime sam nic klientowi nie wysyła."}
      </p>
    </div>
  );
}

/** Wycena po diagnozie: kwota brutto i zakres naprawy; zapis przenosi zlecenie do „Czeka na klienta”. */
export function ServiceQuoteForm({
  order,
  parts,
  pending,
  submit,
  onCancel,
}: {
  order: ServiceOrder;
  parts: OrderPartView[];
  pending: boolean;
  submit: Submit;
  onCancel: () => void;
}) {
  const formId = useId();
  const [amount, setAmount] = useState("");
  const [scope, setScope] = useState(() => defaultQuoteScope(order.workNote, parts));
  const value = parseQuoteAmount(amount);
  const message = value == null ? null : composeQuoteMessage({ items: [{ deviceName: order.deviceName, serialNo: order.serialNo, scope }], amount: value });

  return (
    <form
      aria-labelledby={`${formId}-title`}
      className="space-y-3 rounded-xl border border-[var(--sv-rule)] bg-[var(--sv-box)] p-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (value == null) return;
        submit(() => actionSendServiceQuote({ orderId: order.id, amount, note: scope }));
      }}
    >
      <div id={`${formId}-title`} className="text-sm font-semibold text-slate-900">
        Wycena dla klienta
      </div>
      <div>
        <label htmlFor={`${formId}-amount`} className={fieldLabelClass}>
          Kwota brutto (zł)
        </label>
        <input
          id={`${formId}-amount`}
          value={amount}
          inputMode="decimal"
          autoComplete="off"
          autoFocus
          onChange={(e) => setAmount(e.target.value)}
          aria-invalid={amount !== "" && value == null}
          className={cn(pickerInputClass, "tabular-nums")}
        />
        {amount !== "" && value == null ? <p className="mt-1 text-[0.8125rem] text-red-700">Wpisz kwotę w złotych, np. 674,27.</p> : null}
      </div>
      <div>
        <label htmlFor={`${formId}-scope`} className={fieldLabelClass}>
          Zakres naprawy
        </label>
        <textarea
          id={`${formId}-scope`}
          value={scope}
          rows={4}
          maxLength={1000}
          onChange={(e) => setScope(e.target.value)}
          placeholder="Co zepsute, jakie części do wymiany"
          className="w-full rounded-lg border border-slate-200 bg-card px-3 py-2 text-base focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 sm:text-sm"
        />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Button type="button" variant="secondary" className="min-h-11" onClick={onCancel} disabled={pending}>
          Wróć
        </Button>
        <Button type="submit" className="min-h-11" disabled={pending || value == null}>
          {value == null ? "Zapisz wycenę" : `Zapisz wycenę · ${formatQuoteAmount(value)}`}
        </Button>
      </div>
      <p className="text-[0.8125rem] text-slate-600">Zapis przenosi zlecenie do „Czeka na klienta” i liczy dni bez odpowiedzi.</p>
      <ClientMessage text={message} label="Kopiuj wiadomość do klienta" disabledHint="Wpisz kwotę, a pod spodem pojawi się wiadomość do klienta." />
    </form>
  );
}
