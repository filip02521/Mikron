"use client";

import { useEffect, useId, useState } from "react";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/cn";
import { actionServicePartAvailable, actionWaitForServicePart, type ServiceOrderActionResult } from "@/app/actions/service-orders";
import { pickerInputClass, ProductPicker, type PickedProduct } from "@/components/serwis/SubiektPickers";
import type { ModelPartView } from "@/components/serwis/service-order-view";
import type { ServiceOrder } from "@/lib/orders/service-orders";
import { fieldLabelClass } from "@/lib/ui/serwis-theme";

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
  // Stan wybranej części: na półce wystarczy — wstrzymanie i prośba są zbędne (weź część do zlecenia).
  const [stock, setStock] = useState<{ twId: number; available: number | null } | null>(null);
  const partTwId = part?.twId ?? null;
  useEffect(() => {
    if (partTwId == null) return;
    let alive = true;
    actionServicePartAvailable(partTwId).then(
      (available) => {
        if (!alive) return;
        setStock({ twId: partTwId, available });
        // Domyślnie: część leży na półce — bez prośby, brakuje — z prośbą (serwisant może zmienić).
        if (available != null) setReport(available < Math.max(1, Number(qty) || 1));
      },
      () => alive && setStock({ twId: partTwId, available: null })
    );
    return () => {
      alive = false;
    };
    // Tylko przy zmianie części — zmiana ilości nie odpytuje Subiekta ponownie.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [partTwId]);
  const available = stock && stock.twId === partTwId ? stock.available : undefined;
  const need = Math.max(1, Number(qty) || 1);

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
          freeTextHint="Bez wyboru zapiszemy samą nazwę — bez zgłoszenia do zakupów."
        />
        <div>
          <label htmlFor={`${formId}-qty`} className={fieldLabelClass}>
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
      {fromSubiekt ? (
        <p aria-live="polite" className="text-[0.8125rem] text-slate-700">
          {available === undefined
            ? "Sprawdzam stan części w Subiekcie…"
            : available == null
              ? "Nie udało się sprawdzić stanu w Subiekcie."
              : available >= need
                ? `Na stanie: ${available} szt. do wzięcia — zamiast wstrzymywać, pobierz ją do zlecenia („Pobierz część”).`
                : available > 0
                  ? `Na stanie tylko ${available} szt. — brakuje ${need - available}.`
                  : "Na stanie: 0 szt."}
        </p>
      ) : null}
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
