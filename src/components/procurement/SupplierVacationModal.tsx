"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  actionListActiveVacationsForSupplier,
  actionUpsertVacation,
} from "@/app/actions/admin";
import { VacationSavePreview } from "@/components/admin/VacationSavePreview";
import { useActionPending } from "@/hooks/useActionPending";
import { Button } from "@/components/ui/Button";
import { Field, Input, Select } from "@/components/ui/Field";
import { ModalShell } from "@/components/ui/ModalShell";
import { Spinner } from "@/components/ui/Spinner";
import { formatPlDate, vacationNoteLabel } from "@/lib/display-labels";

type VacationRecord = {
  id: string;
  start_date: string;
  end_date: string;
  last_order_date: string;
  active: boolean;
};

type VacationForm = {
  id?: string;
  start_date: string;
  end_date: string;
  last_order_date: string;
  active: boolean;
};

const NEW_VACATION = "__new__";

const emptyForm = (): VacationForm => ({
  start_date: "",
  end_date: "",
  last_order_date: "",
  active: true,
});

function recordToForm(record: VacationRecord): VacationForm {
  return {
    id: record.id,
    start_date: record.start_date,
    end_date: record.end_date,
    last_order_date: record.last_order_date,
    active: record.active,
  };
}

function vacationOptionLabel(record: VacationRecord): string {
  return `${formatPlDate(record.start_date)} – ${formatPlDate(record.end_date)}`;
}

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
  const router = useRouter();
  const { pending, pendingMessage, run } = useActionPending();
  const [loadingExisting, setLoadingExisting] = useState(true);
  const [existingVacations, setExistingVacations] = useState<VacationRecord[]>([]);
  const [selection, setSelection] = useState<string>(NEW_VACATION);
  const [form, setForm] = useState<VacationForm>(emptyForm);

  useEffect(() => {
    let cancelled = false;
    void actionListActiveVacationsForSupplier(supplierId)
      .then(({ vacations }) => {
        if (cancelled) return;
        setExistingVacations(vacations);
        if (vacations.length) {
          setSelection(vacations[0]!.id);
          setForm(recordToForm(vacations[0]!));
        } else {
          setSelection(NEW_VACATION);
          setForm(emptyForm());
        }
      })
      .catch((error) => {
        if (cancelled) return;
        onError?.(
          error instanceof Error
            ? error.message
            : "Nie udało się wczytać urlopów dostawcy."
        );
        setExistingVacations([]);
        setSelection(NEW_VACATION);
        setForm(emptyForm());
      })
      .finally(() => {
        if (!cancelled) setLoadingExisting(false);
      });
    return () => {
      cancelled = true;
    };
  }, [supplierId, onError]);

  const handleSelectionChange = (value: string) => {
    setSelection(value);
    if (value === NEW_VACATION) {
      setForm(emptyForm());
      return;
    }
    const record = existingVacations.find((row) => row.id === value);
    if (record) setForm(recordToForm(record));
  };

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
        if (!result.active && form.active) {
          parts.push("Urlop nie został aktywowany — sprawdź daty okresu.");
        }
        if (result.nextDate) {
          parts.push(`Następne zamówienie: ${formatPlDate(result.nextDate)}`);
        }
        if (result.vacationNote) {
          parts.push(vacationNoteLabel(result.vacationNote));
        }
        if (result.syncErrors.length) {
          parts.push(`Uwagi: ${result.syncErrors.slice(0, 2).join("; ")}`);
        }
        router.refresh();
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

  const previewForm = {
    ...form,
    supplier_id: supplierId,
  };

  return (
    <ModalShell
      open
      onClose={onClose}
      title={`Urlop — ${supplierName}`}
      description={
        existingVacations.length > 1
          ? `${existingVacations.length} aktywne urlopy — wybierz wpis do edycji lub dodaj nowy (okresy nie mogą się nakładać).`
          : form.id
            ? "Edytujesz aktywny urlop. Po zapisie termin przeliczy się automatycznie."
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
            {pending ? (
              <>
                <Spinner size="sm" />
                Zapis…
              </>
            ) : form.id ? (
              "Zapisz zmiany"
            ) : (
              "Zapisz urlop"
            )}
          </Button>
        </>
      }
    >
      {loadingExisting ? (
        <div className="flex items-center gap-2 py-6 text-sm text-slate-600">
          <Spinner size="sm" />
          Wczytywanie urlopów…
        </div>
      ) : (
        <div className="grid gap-3">
          {existingVacations.length ? (
            <Field label="Edytowany wpis">
              <Select
                disabled={pending}
                value={selection}
                onChange={(e) => handleSelectionChange(e.target.value)}
              >
                {existingVacations.map((record) => (
                  <option key={record.id} value={record.id}>
                    {vacationOptionLabel(record)}
                  </option>
                ))}
                <option value={NEW_VACATION}>+ Dodaj nowy urlop</option>
              </Select>
            </Field>
          ) : null}
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
              className="h-4 w-4 rounded border-slate-300"
              disabled={pending}
              checked={form.active}
              onChange={(e) => setForm({ ...form, active: e.target.checked })}
            />
            Urlop aktywny (uwzględniany w terminach i przy „Zamówione”)
          </label>
          <VacationSavePreview form={previewForm} disabled={pending} />
        </div>
      )}
    </ModalShell>
  );
}
