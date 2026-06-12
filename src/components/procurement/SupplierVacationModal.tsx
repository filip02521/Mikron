"use client";

import { useEffect, useState } from "react";
import {
  actionGetEditableVacationForSupplier,
  actionUpsertVacation,
} from "@/app/actions/admin";
import { useActionPending } from "@/hooks/useActionPending";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Field";
import { ModalShell } from "@/components/ui/ModalShell";
import { Spinner } from "@/components/ui/Spinner";
import { vacationNoteLabel } from "@/lib/display-labels";
import { formatPlDate } from "@/lib/display-labels";

type VacationForm = {
  id?: string;
  start_date: string;
  end_date: string;
  last_order_date: string;
  active: boolean;
};

const emptyForm = (): VacationForm => ({
  start_date: "",
  end_date: "",
  last_order_date: "",
  active: true,
});

export function SupplierVacationModal({
  supplierId,
  supplierName,
  onClose,
  onSaved,
  onError,
}: {
  supplierId: string;
  supplierName: string;
  onClose: () => void;
  onSaved?: (message: string) => void;
  onError?: (message: string) => void;
}) {
  const { pending, pendingMessage, run } = useActionPending();
  const [loadingExisting, setLoadingExisting] = useState(true);
  const [form, setForm] = useState<VacationForm>(emptyForm);

  useEffect(() => {
    let cancelled = false;
    void actionGetEditableVacationForSupplier(supplierId)
      .then((existing) => {
        if (cancelled) return;
        if (existing) {
          setForm({
            id: existing.id,
            start_date: existing.start_date,
            end_date: existing.end_date,
            last_order_date: existing.last_order_date,
            active: existing.active,
          });
        } else {
          setForm(emptyForm());
        }
      })
      .catch((error) => {
        if (cancelled) return;
        onError?.(
          error instanceof Error
            ? error.message
            : "Nie udało się wczytać urlopu dostawcy."
        );
        setForm(emptyForm());
      })
      .finally(() => {
        if (!cancelled) setLoadingExisting(false);
      });
    return () => {
      cancelled = true;
    };
  }, [supplierId, onError]);

  const save = () => {
    if (!form.start_date || !form.end_date || !form.last_order_date) {
      onError?.("Uzupełnij wszystkie daty urlopu.");
      return;
    }
    run(
      async () => {
        const result = await actionUpsertVacation({
          supplier_id: supplierId,
          ...form,
        });
        const parts = [
          form.id
            ? `Urlop zaktualizowany dla ${supplierName}.`
            : `Urlop zapisany dla ${supplierName}.`,
        ];
        if (result.nextDate) {
          parts.push(`Następne zamówienie: ${formatPlDate(result.nextDate)}`);
        }
        if (result.vacationNote) {
          parts.push(vacationNoteLabel(result.vacationNote));
        }
        if (result.syncErrors.length) {
          parts.push(`Uwagi: ${result.syncErrors.slice(0, 2).join("; ")}`);
        }
        onSaved?.(parts.join(" "));
        onClose();
      },
      `Zapis urlopu i przeliczanie harmonogramów…`,
      {
        onError: (error) => {
          onError?.(
            error instanceof Error ? error.message : "Nie udało się zapisać urlopu."
          );
        },
      }
    );
  };

  return (
    <ModalShell
      open
      onClose={onClose}
      title={`Urlop — ${supplierName}`}
      description={
        form.id
          ? "Edytujesz aktywny urlop tego dostawcy. Po zapisie termin przeliczy się automatycznie."
          : "Po zapisie terminy przeliczą się automatycznie w panelu dziennym."
      }
      titleId="vacation-modal-title"
      size="sm"
      tier="raised"
      loadingMessage={pendingMessage}
      disableBackdropClose={pending || loadingExisting}
      bodyClassName="px-5 py-4 sm:px-6"
      footer={
        <>
          <Button variant="ghost" disabled={pending || loadingExisting} onClick={onClose}>
            Anuluj
          </Button>
          <Button disabled={pending || loadingExisting} onClick={save}>
            {form.id ? "Zapisz zmiany" : "Zapisz urlop"}
          </Button>
        </>
      }
    >
      {loadingExisting ? (
        <div className="flex items-center gap-2 py-6 text-sm text-slate-600">
          <Spinner size="sm" />
          Wczytywanie urlopu…
        </div>
      ) : (
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
      )}
    </ModalShell>
  );
}
