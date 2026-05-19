"use client";

import { useState } from "react";
import { actionUpsertVacation } from "@/app/actions/admin";
import { useActionPending } from "@/hooks/useActionPending";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Field";
import { ModalShell } from "@/components/ui/ModalShell";
import { vacationNoteLabel } from "@/lib/display-labels";
import { formatPlDate } from "@/lib/display-labels";

export function SupplierVacationModal({
  supplierId,
  supplierName,
  onClose,
  onSaved,
}: {
  supplierId: string;
  supplierName: string;
  onClose: () => void;
  onSaved?: (message: string) => void;
}) {
  const { pending, pendingMessage, run } = useActionPending();
  const [form, setForm] = useState({
    start_date: "",
    end_date: "",
    last_order_date: "",
    active: true,
  });

  const save = () => {
    if (!form.start_date || !form.end_date || !form.last_order_date) return;
    run(
      async () => {
        const result = await actionUpsertVacation({
          supplier_id: supplierId,
          ...form,
        });
        const parts = [`Urlop zapisany dla ${supplierName}.`];
        if (result.nextDate) {
          parts.push(`Następne zamówienie: ${formatPlDate(result.nextDate)}`);
        }
        if (result.vacationNote) {
          parts.push(vacationNoteLabel(result.vacationNote));
        }
        onSaved?.(parts.join(" "));
        onClose();
      },
      `Zapis urlopu i przeliczanie harmonogramów…`
    );
  };

  return (
    <ModalShell
      open
      onClose={onClose}
      title={`Urlop — ${supplierName}`}
      description="Po zapisie terminy przeliczą się automatycznie w panelu dziennym."
      titleId="vacation-modal-title"
      size="sm"
      tier="raised"
      loadingMessage={pendingMessage}
      disableBackdropClose={pending}
      bodyClassName="px-5 py-4 sm:px-6"
      footer={
        <>
          <Button variant="ghost" disabled={pending} onClick={onClose}>
            Anuluj
          </Button>
          <Button disabled={pending} onClick={save}>
            Zapisz urlop
          </Button>
        </>
      }
    >
      <div className="grid gap-3">
        <Field label="Urlop od">
          <Input
            type="date"
            disabled={pending}
            value={form.start_date}
            onChange={(e) => setForm({ ...form, start_date: e.target.value })}
          />
        </Field>
        <Field label="Urlop do">
          <Input
            type="date"
            disabled={pending}
            value={form.end_date}
            onChange={(e) => setForm({ ...form, end_date: e.target.value })}
          />
        </Field>
        <Field label="Ostatnie zamówienie przed urlopem">
          <Input
            type="date"
            disabled={pending}
            value={form.last_order_date}
            onChange={(e) => setForm({ ...form, last_order_date: e.target.value })}
          />
        </Field>
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            className="rounded border-slate-300"
            disabled={pending}
            checked={form.active}
            onChange={(e) => setForm({ ...form, active: e.target.checked })}
          />
          Urlop aktywny
        </label>
      </div>
    </ModalShell>
  );
}
