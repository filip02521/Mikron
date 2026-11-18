"use client";

import { useId, useState } from "react";
import { IconPlus } from "@/components/icons/StrokeIcons";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Field";
import type { ZdEstimateRunMode } from "@/lib/orders/zd-estimate-scope";

/**
 * „Dodaj dostawcę” w nagłówku wspólnego zakresu: dopisuje tę samą grupę lub cechę
 * kolejnemu dostawcy bez przechodzenia przez kartę „Dostawcy”.
 * `onAdd` zwraca `true`, gdy użytkownik potwierdził — formularz się wtedy zwija.
 */
export function ZdSharedScopeAddSupplier({
  mode,
  candidates,
  disabled,
  onAdd,
}: {
  mode: ZdEstimateRunMode;
  /** Dostawcy, którzy tego zakresu jeszcze nie mają. */
  candidates: readonly { id: string; name: string }[];
  disabled: boolean;
  onAdd: (supplierId: string) => Promise<boolean>;
}) {
  const selectId = useId();
  const [open, setOpen] = useState(false);
  const [supplierId, setSupplierId] = useState("");
  const [asking, setAsking] = useState(false);

  if (candidates.length === 0) return null;

  const close = () => {
    setOpen(false);
    setSupplierId("");
  };

  if (!open) {
    return (
      <Button
        type="button"
        size="sm"
        variant="secondary"
        disabled={disabled}
        onClick={() => setOpen(true)}
        title={
          mode === "cecha"
            ? "Przypisz tę cechę kolejnemu dostawcy"
            : "Przypisz tę grupę kolejnemu dostawcy"
        }
      >
        <IconPlus size={14} strokeWidth={2} aria-hidden />
        Dodaj dostawcę
      </Button>
    );
  }

  // Wybrany dostawca mógł w międzyczasie dostać ten zakres (odświeżenie okna).
  const picked = candidates.some((c) => c.id === supplierId) ? supplierId : "";
  const submit = async () => {
    if (!picked || asking) return;
    setAsking(true);
    try {
      if (await onAdd(picked)) close();
    } finally {
      setAsking(false);
    }
  };

  return (
    <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto" role="group" aria-label="Dodaj dostawcę do zakresu">
      <label htmlFor={selectId} className="sr-only">
        Dostawca do dodania
      </label>
      <Select
        id={selectId}
        value={picked}
        disabled={disabled || asking}
        onChange={(e) => setSupplierId(e.target.value)}
        className="min-w-0 flex-1 sm:w-64 sm:flex-none"
        autoFocus
      >
        <option value="">Wybierz dostawcę…</option>
        {candidates.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </Select>
      <Button
        type="button"
        variant="outline"
        className="h-10 shrink-0"
        disabled={disabled || asking || !picked}
        onClick={() => void submit()}
      >
        {mode === "cecha" ? "Dodaj do cechy" : "Dodaj do grupy"}
      </Button>
      <Button type="button" variant="ghost" className="h-10 shrink-0" disabled={asking} onClick={close}>
        Anuluj
      </Button>
    </div>
  );
}
