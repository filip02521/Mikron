"use client";

import { useId, useState, useTransition } from "react";
import { ModalShell } from "@/components/ui/ModalShell";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Field";
import { actionSetServicePartMinStock } from "@/app/actions/service-parts";
import type { ServicePartRow } from "@/lib/orders/service-parts-overview";

/**
 * Minimum części na stanie. Zakupy (Kreator i Automat ZD) dokupią do niego sami — bez zgłoszenia.
 * Pole startuje z obecnym minimum (to ustawienie, nie ilość do zamówienia), puste, gdy minimum nie ma.
 */
export function ServicePartMinStockDialog({
  part,
  onClose,
  onSaved,
}: {
  part: ServicePartRow | null;
  onClose: () => void;
  onSaved: (message: string) => void;
}) {
  const id = useId();
  const [value, setValue] = useState(part?.minStock ? String(part.minStock) : "");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  if (!part) return null;

  const raw = value.trim();
  const n = raw === "" ? 0 : Number(raw);
  const valid = raw === "" || (Number.isInteger(n) && n >= 0 && n <= 500);
  const had = (part.minStock ?? 0) > 0;
  const shortfall = valid && n > 0 ? Math.max(0, Math.ceil(n - part.available)) : 0;
  const at = part.supplierName ? ` u ${part.supplierName}` : "";
  const effect = !valid
    ? "Wpisz liczbę całkowitą od 0 do 500."
    : n > 0 && !part.supplierName
      ? "Zakupy nie zamawiają jeszcze tej części przez Kreator ZD (brak dostawcy z historii albo dostawca bez zakresu w Kreatorze) — minimum zapisze się, ale zadziała dopiero, gdy zakupy to ustawią. Do tego czasu zgłoś brak przyciskiem „Zgłoś brak”."
      : n > 0
        ? shortfall > 0
          ? `Przy najbliższym ZD${at} zakupy dokupią do ${shortfall} szt. (mniej, jeśli część już jedzie). Dalej będą dobijać do ${n} szt. same, bez zgłoszenia.`
          : `Na stanie jest ${part.available} szt. — teraz nic nie trafi do ZD. Gdy spadnie poniżej ${n} szt., zakupy dokupią${at} same, bez zgłoszenia.`
      : had
        ? "Bez minimum: część znów zamawiana tylko po zgłoszeniu („Zgłoś brak”)."
        : "Bez minimum część jest zamawiana tylko po zgłoszeniu („Zgłoś brak”).";

  const save = () => {
    if (!valid) return;
    start(async () => {
      const res = await actionSetServicePartMinStock({ twId: part.twId, minStock: n });
      if (!res.ok) {
        setError(res.message);
        return;
      }
      onSaved(res.message);
    });
  };

  return (
    <ModalShell
      open
      className="touch-ui"
      onClose={onClose}
      title={`Minimum na stanie: ${part.name}`}
      description={`Dostępne: ${part.available} szt.${had ? `, obecne minimum ${part.minStock} szt.` : ""}`}
      size="md"
      bodyClassName="px-5 py-4 sm:px-6 sm:py-5"
      loadingMessage={pending ? "Zapisuję…" : null}
      footer={
        <div className="flex w-full justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose} disabled={pending}>
            Anuluj
          </Button>
          <Button type="submit" form={`${id}-form`} disabled={pending || !valid || (n === 0 && !had)}>
            {pending ? "Zapisuję…" : n === 0 && had ? "Usuń minimum" : "Zapisz minimum"}
          </Button>
        </div>
      }
    >
      <form
        id={`${id}-form`}
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          save();
        }}
      >
        <Field label="Ile sztuk trzymać na stanie" error={error ?? undefined} state={error || !valid ? "error" : "default"}>
          <Input
            id={id}
            inputMode="numeric"
            autoFocus
            value={value}
            placeholder="np. 3"
            onChange={(e) => {
              setValue(e.target.value);
              setError(null);
            }}
            state={error || !valid ? "error" : "default"}
          />
        </Field>
        <p aria-live="polite" className="rounded-lg bg-slate-50 px-3.5 py-3 text-sm text-slate-700">
          {effect}
        </p>
      </form>
    </ModalShell>
  );
}
