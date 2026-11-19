"use client";

import { useRouter } from "next/navigation";
import { userFacingErrorText } from "@/lib/ui/user-facing-error";
import { useEffect, useState } from "react";
import {
  actionListActiveVacationsForSupplier,
  actionUpsertVacation,
} from "@/app/actions/admin";
import { VacationSavePreview } from "@/components/admin/VacationSavePreview";
import { useActionPending } from "@/hooks/useActionPending";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Field, Input, Select } from "@/components/ui/Field";
import { ModalShell } from "@/components/ui/ModalShell";
import { Spinner } from "@/components/ui/Spinner";
import { formatPlDate, vacationNoteLabel } from "@/lib/display-labels";
import {
  defaultVacationLastOrderDate,
  validateVacationFormInput,
} from "@/lib/orders/vacation-form-validation";
import { todayDateKeyInWarsaw } from "@/lib/time/warsaw";
import { BrandLoader } from "@/components/ui/BrandLoader";

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

type DateField = "start_date" | "end_date" | "last_order_date";

const NEW_VACATION = "__new__";

const DATE_FIELD_LABEL: Record<DateField, string> = {
  start_date: "Urlop od",
  end_date: "Urlop do",
  last_order_date: "Ostatnie zamówienie przed urlopem",
};

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
  return `${formatPlDate(record.start_date)} - ${formatPlDate(record.end_date)}`;
}

function missingDateFields(form: VacationForm): DateField[] {
  return (Object.keys(DATE_FIELD_LABEL) as DateField[]).filter((key) => !form[key]);
}

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
  const router = useRouter();
  const { pending, pendingMessage, run } = useActionPending();
  const [loadingExisting, setLoadingExisting] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [existingVacations, setExistingVacations] = useState<VacationRecord[]>([]);
  const [selection, setSelection] = useState<string>(NEW_VACATION);
  const [form, setForm] = useState<VacationForm>(emptyForm);
  /** „Ostatnie zamówienie” wpisane przez okno (dzień roboczy przed urlopem) — przesuwa się razem z „Urlop od”. */
  const [lastOrderSuggested, setLastOrderSuggested] = useState(false);
  /** Pola bez daty po kliknięciu „Zapisz” — zaznaczone na czerwono. */
  const [missing, setMissing] = useState<DateField[]>([]);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Tylko supplierId: callback od rodzica zmienia się przy każdym odświeżeniu panelu (co 25 s),
  // a ponowne wczytanie nadpisywało wpisane daty pustym formularzem.
  useEffect(() => {
    let cancelled = false;
    void actionListActiveVacationsForSupplier(supplierId)
      .then(({ vacations }) => {
        if (cancelled) return;
        setExistingVacations(vacations);
        if (vacations.length) {
          setSelection(vacations[0]!.id);
          setForm(recordToForm(vacations[0]!));
        }
      })
      .catch((error) => {
        if (cancelled) return;
        setLoadError(
          userFacingErrorText(error, "Nie udało się wczytać zapisanych urlopów - możesz dodać nowy.")
        );
      })
      .finally(() => {
        if (!cancelled) setLoadingExisting(false);
      });
    return () => {
      cancelled = true;
    };
  }, [supplierId]);

  const resetFeedback = () => {
    setMissing([]);
    setSaveError(null);
  };

  const handleSelectionChange = (value: string) => {
    setSelection(value);
    resetFeedback();
    setLastOrderSuggested(false);
    if (value === NEW_VACATION) {
      setForm(emptyForm());
      return;
    }
    const record = existingVacations.find((row) => row.id === value);
    if (record) setForm(recordToForm(record));
  };

  const setDate = (field: DateField, value: string) => {
    resetFeedback();
    const next = { ...form, [field]: value };
    let suggested = field === "last_order_date" ? false : lastOrderSuggested;
    // Podpowiedź idzie za „Urlop od”, dopóki ktoś nie wpisze własnej daty ostatniego zamówienia.
    if (field === "start_date" && (lastOrderSuggested || !form.last_order_date)) {
      next.last_order_date = defaultVacationLastOrderDate(value) ?? "";
      suggested = Boolean(next.last_order_date);
    }
    setForm(next);
    setLastOrderSuggested(suggested);
  };

  const todayKey = todayDateKeyInWarsaw();
  const complete = missingDateFields(form).length === 0;
  // Ta sama walidacja co na serwerze — błąd widać od razu, a nie dopiero po kliknięciu „Zapisz”.
  const liveError = complete ? validateVacationFormInput({ ...form, supplier_id: supplierId }, todayKey).error : null;
  const disabling = Boolean(form.id) && !form.active;

  const save = () => {
    const empty = missingDateFields(form);
    if (empty.length) {
      // Puste pola dostają czerwone „Wpisz datę” — bez drugiego komunikatu o tym samym pod spodem.
      setMissing(empty);
      return;
    }
    if (liveError) return;
    run(
      async () => {
        const result = await actionUpsertVacation({
          supplier_id: supplierId,
          ...form,
        });
        const parts = [
          disabling
            ? `Urlop ${supplierName} wyłączony - terminy wracają do zwykłego rytmu.`
            : form.id
              ? `Urlop zaktualizowany dla ${supplierName}.`
              : `Urlop zapisany dla ${supplierName}.`,
        ];
        if (!result.active && form.active) {
          parts.push("Urlop nie został włączony - sprawdź daty okresu.");
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
      disabling ? "Wyłączanie urlopu i przeliczanie terminów…" : "Zapis urlopu i przeliczanie terminów…",
      {
        onError: (error) => {
          setSaveError(userFacingErrorText(error, "Nie udało się zapisać urlopu. Spróbuj ponownie."));
        },
      }
    );
  };

  const previewForm = {
    ...form,
    supplier_id: supplierId,
  };
  // Jeden komunikat naraz: błąd dat albo błąd zapisu zastępuje podgląd (podgląd pokazałby ten sam tekst).
  const formMessage = liveError ?? saveError;

  const fieldError = (field: DateField) => (missing.includes(field) ? "Wpisz datę" : undefined);

  return (
    <ModalShell
      open
      onClose={onClose}
      title={`Urlop - ${supplierName}`}
      description={
        existingVacations.length > 1
          ? `${existingVacations.length} zapisane urlopy - wybierz, który zmieniasz, albo dodaj nowy (okresy nie mogą się nakładać).`
          : form.id
            ? "Zmieniasz zapisany urlop. Po zapisie terminy zamówień przeliczą się same."
            : "Terminy zamówień, które wypadną w czasie urlopu, przesuną się same."
      }
      titleId="vacation-modal-title"
      size="sm"
      tier="raised"
      loadingMessage={pendingMessage}
      disableBackdropClose={pending || loadingExisting}
      bodyClassName="px-5 py-4 sm:px-6"
      footer={
        <>
          <Button variant="ghost" disabled={pending} onClick={onClose}>
            Anuluj
          </Button>
          <Button disabled={pending || loadingExisting} onClick={save}>
            {pending ? (
              <>
                <Spinner size="sm" />
                Zapis…
              </>
            ) : disabling ? (
              "Wyłącz urlop"
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
        <div className="flex items-center gap-2 py-6 text-sm text-slate-600" role="status">
          <BrandLoader size="sm" tile={false} />
          Wczytywanie zapisanych urlopów…
        </div>
      ) : (
        <div className="grid gap-3">
          {loadError ? <Alert tone="warning">{loadError}</Alert> : null}
          {existingVacations.length ? (
            <Field label="Który urlop">
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
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label={DATE_FIELD_LABEL.start_date} error={fieldError("start_date")}>
              <Input
                type="date"
                disabled={pending}
                value={form.start_date}
                onChange={(e) => setDate("start_date", e.target.value)}
              />
            </Field>
            <Field label={DATE_FIELD_LABEL.end_date} error={fieldError("end_date")}>
              <Input
                type="date"
                disabled={pending}
                min={form.start_date || undefined}
                value={form.end_date}
                onChange={(e) => setDate("end_date", e.target.value)}
              />
            </Field>
          </div>
          <Field
            label={DATE_FIELD_LABEL.last_order_date}
            error={fieldError("last_order_date")}
            hint={
              lastOrderSuggested && form.last_order_date
                ? "Wpisane: dzień roboczy przed urlopem. Zmień, jeśli dostawca podał inny termin."
                : "Do tego dnia dostawca przyjmie zamówienie."
            }
          >
            <Input
              type="date"
              disabled={pending}
              max={form.start_date || undefined}
              value={form.last_order_date}
              onChange={(e) => setDate("last_order_date", e.target.value)}
            />
          </Field>
          {form.id ? (
            <label className="flex items-start gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                className="mt-0.5 h-4 w-4 rounded border-slate-300"
                disabled={pending}
                checked={form.active}
                onChange={(e) => {
                  resetFeedback();
                  setForm({ ...form, active: e.target.checked });
                }}
              />
              <span>
                Urlop obowiązuje
                <span className="block text-xs text-slate-500">
                  Odznacz, jeśli dostawca odwołał urlop - terminy wrócą do zwykłego rytmu.
                </span>
              </span>
            </label>
          ) : null}
          {formMessage ? (
            <Alert tone="error">{formMessage}</Alert>
          ) : complete ? (
            <VacationSavePreview form={previewForm} disabled={pending} />
          ) : null}
        </div>
      )}
    </ModalShell>
  );
}
