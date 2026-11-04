"use client";

import { useId, useState, useTransition } from "react";
import { ModalShell } from "@/components/ui/ModalShell";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Field";
import { actionReportServicePartShortage } from "@/app/actions/service-parts";
import type { ServicePartRow } from "@/lib/orders/service-parts-overview";

export function ServicePartReportDialog({
  part,
  onClose,
  onReported,
}: {
  part: ServicePartRow | null;
  onClose: () => void;
  onReported: (message: string) => void;
}) {
  const qtyId = useId();
  const noteId = useId();
  // Pole ilości bez domyślnej liczby (DESIGN.md → Teksty): liczba, której nikt nie wpisał, wygląda na zamówioną.
  const [qty, setQty] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  if (!part) return null;

  const submit = () => {
    const quantity = Number(qty.replace(",", "."));
    start(async () => {
      const res = await actionReportServicePartShortage({ twId: part.twId, quantity, note });
      if (!res.ok) {
        setError(res.message);
        return;
      }
      onReported(res.message);
    });
  };

  return (
    <ModalShell
      open
      onClose={onClose}
      title={`Zgłoś brak: ${part.name}`}
      description={`Dostępne: ${part.available} szt.${part.takenWithoutRw ? ` (w tym odjęte ${part.takenWithoutRw} pobrane do zleceń bez RW)` : ""}${part.minStock ? `, minimum ${part.minStock} szt.` : ""}. Zakupy zamówią dokładnie tyle, ile wpiszesz.`}
      size="md"
      bodyClassName="px-5 py-4 sm:px-6 sm:py-5"
      loadingMessage={pending ? "Zgłaszam…" : null}
      footer={
        <div className="flex w-full justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose} disabled={pending}>
            Anuluj
          </Button>
          <Button type="submit" form={`${qtyId}-form`} disabled={pending || !qty.trim()}>
            {pending ? "Zgłaszam…" : "Zgłoś brak"}
          </Button>
        </div>
      }
    >
      <form
        id={`${qtyId}-form`}
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <Field label="Ile potrzebujesz (szt.)" error={error ?? undefined} state={error ? "error" : "default"}>
          <Input
            id={qtyId}
            inputMode="numeric"
            autoFocus
            value={qty}
            onChange={(e) => {
              setQty(e.target.value);
              setError(null);
            }}
            state={error ? "error" : "default"}
          />
        </Field>
        <Field label="Do czego (opcjonalnie)" hint="Np. numer zlecenia albo klient. Trafi do uwag prośby.">
          <Input id={noteId} value={note} maxLength={200} onChange={(e) => setNote(e.target.value)} />
        </Field>
      </form>
    </ModalShell>
  );
}
