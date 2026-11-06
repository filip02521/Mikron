"use client";

import { useId, useState } from "react";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/cn";
import { actionWaitForServicePart, type ServiceOrderActionResult } from "@/app/actions/service-orders";
import { pickerInputClass, ProductPicker, type PickedProduct } from "@/components/serwis/SubiektPickers";
import type { ModelPartView } from "@/components/serwis/service-order-view";
import { SERVICE_PARTS_CECHA_NAME } from "@/lib/orders/service-parts";
import type { ServiceOrder } from "@/lib/orders/service-orders";

type Submit = (fn: () => Promise<ServiceOrderActionResult>, after?: () => void) => void;

/**
 * Wstrzymanie naprawy: na jaką część czeka zlecenie (z katalogu modelu, z Subiekta albo wpisana) i czy
 * od razu zgłosić brak zakupom — ta sama prośba co „Zgłoś brak” na ekranie części.
 */
export function ServiceOrderWaitForm({
  order,
  modelParts,
  pending,
  submit,
  onCancel,
}: {
  order: ServiceOrder;
  modelParts: ModelPartView[];
  pending: boolean;
  submit: Submit;
  onCancel: () => void;
}) {
  const formId = useId();
  const [part, setPart] = useState<PickedProduct | null>(null);
  const [pickerKey, setPickerKey] = useState(0);
  const [qty, setQty] = useState("1");
  const [report, setReport] = useState(true);
  const bom = order.deviceTwId ? modelParts.filter((m) => m.modelTwId === order.deviceTwId) : [];
  const fromSubiekt = part?.twId != null;

  return (
    <form
      aria-labelledby={`${formId}-title`}
      className="space-y-3 rounded-xl border border-amber-200 bg-amber-50 p-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (!part) return;
        submit(() =>
          actionWaitForServicePart({
            orderId: order.id,
            partTwId: part.twId,
            partName: part.name,
            quantity: Number(qty),
            report: report && fromSubiekt,
          })
        );
      }}
    >
      <div id={`${formId}-title`} className="text-sm font-semibold text-slate-900">
        Na jaką część czeka zlecenie?
      </div>
      {bom.length ? (
        <div role="group" aria-label="Części z katalogu modelu" className="flex flex-wrap gap-1.5">
          {bom.map((b) => (
            <button
              key={b.partTwId}
              type="button"
              aria-pressed={part?.twId === b.partTwId}
              onClick={() => {
                setPart({ twId: b.partTwId, symbol: b.partSymbol, name: b.partName });
                setPickerKey((k) => k + 1);
              }}
              className={cn(
                "inline-flex min-h-11 max-w-full items-center rounded-2xl border px-3.5 py-1.5 text-left text-sm transition-colors duration-150",
                part?.twId === b.partTwId ? "border-indigo-600 bg-indigo-50 font-semibold text-indigo-900" : "border-slate-200 bg-card text-slate-700 hover:bg-slate-100"
              )}
            >
              {b.partSymbol ?? b.partName}
            </button>
          ))}
        </div>
      ) : null}
      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_6rem]">
        <ProductPicker
          key={pickerKey}
          value={part}
          onChange={setPart}
          label={bom.length ? "Albo inna część" : "Część"}
          placeholder="Symbol albo nazwa części"
          allowFreeText
          freeTextHint="Część spoza Subiekta — zapiszemy nazwę, bez zgłoszenia do zakupów."
        />
        <div>
          <label htmlFor={`${formId}-qty`} className="mb-1.5 block text-xs font-semibold text-slate-600">
            Ilość
          </label>
          <input
            id={`${formId}-qty`}
            value={qty}
            inputMode="numeric"
            onChange={(e) => setQty(e.target.value.replace(/[^\d]/g, "").slice(0, 3))}
            className={`${pickerInputClass} tabular-nums`}
          />
        </div>
      </div>
      <label className={cn("flex min-h-11 items-center gap-2 text-sm", fromSubiekt ? "text-slate-800" : "text-slate-500")}>
        <input
          type="checkbox"
          checked={report && fromSubiekt}
          disabled={!fromSubiekt}
          onChange={(e) => setReport(e.target.checked)}
          className="h-5 w-5 accent-[var(--primary)]"
        />
        Zgłoś brak zakupom (prośba z numerem {order.number})
      </label>
      <p className="text-[0.8125rem] text-slate-600">Zgłoszenie przyjmą tylko części z cechą „{SERVICE_PARTS_CECHA_NAME}”.</p>
      <div className="grid grid-cols-2 gap-2">
        <Button type="button" variant="secondary" onClick={onCancel} disabled={pending}>
          Wróć
        </Button>
        <Button type="submit" disabled={pending || !part || !(Number(qty) > 0)}>
          Wstrzymaj naprawę
        </Button>
      </div>
      {!part ? <p className="text-[0.8125rem] text-slate-600">Wybierz część, żeby wstrzymać naprawę.</p> : null}
    </form>
  );
}
