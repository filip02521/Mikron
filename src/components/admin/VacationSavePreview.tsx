"use client";

import { useEffect, useState } from "react";
import { actionPreviewVacationImpact } from "@/app/actions/admin";
import { formatPlDate, vacationNoteLabel } from "@/lib/display-labels";
import type { VacationAdminFormState } from "@/components/admin/VacationAdminForm";
import { Spinner } from "@/components/ui/Spinner";

type PreviewResponse = Awaited<ReturnType<typeof actionPreviewVacationImpact>>;
type PreviewSnapshot = NonNullable<PreviewResponse["preview"]>["before"];

function previewLine(snapshot: PreviewSnapshot) {
  const datePart = snapshot.nextDate ? formatPlDate(snapshot.nextDate) : "brak terminu";
  const notePart = snapshot.vacationNote ? ` — ${vacationNoteLabel(snapshot.vacationNote)}` : "";
  return `${datePart}${notePart}`;
}

/** Podgląd wpływu urlopu na termin następnego zamówienia (przed zapisem). */
export function VacationSavePreview({
  form,
  disabled,
}: {
  form: VacationAdminFormState;
  disabled?: boolean;
}) {
  const formComplete = Boolean(
    form.supplier_id && form.start_date && form.end_date && form.last_order_date
  );
  const formKey = [
    form.supplier_id,
    form.start_date,
    form.end_date,
    form.last_order_date,
    form.active,
    form.id ?? "",
  ].join("\0");

  const [response, setResponse] = useState<PreviewResponse | null>(null);
  const [resolvedKey, setResolvedKey] = useState<string | null>(null);

  useEffect(() => {
    if (disabled || !formComplete) return;

    let cancelled = false;

    const timer = window.setTimeout(() => {
      void actionPreviewVacationImpact(form)
        .then((result) => {
          if (cancelled) return;
          setResponse(result);
          setResolvedKey(formKey);
        })
        .catch((error) => {
          if (cancelled) return;
          setResponse({
            preview: null,
            validationError:
              error instanceof Error ? error.message : "Nie udało się policzyć podglądu.",
          });
          setResolvedKey(formKey);
        });
    }, 350);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [disabled, formComplete, formKey, form]);

  if (!formComplete) return null;

  const loading = resolvedKey !== formKey;
  const preview = response?.preview;
  const validationError = response?.validationError;
  const unchanged =
    preview &&
    preview.before.nextDate === preview.after.nextDate &&
    preview.before.vacationNote === preview.after.vacationNote;

  return (
    <div
      className="rounded-md border border-slate-200/90 bg-slate-50/80 px-3 py-3 text-sm text-slate-700 sm:px-4"
      aria-live="polite"
    >
      <p className="font-semibold text-slate-900">Podgląd po zapisie</p>
      {loading ? (
        <p className="mt-2 flex items-center gap-2 text-slate-600">
          <Spinner size="sm" />
          Liczenie terminu…
        </p>
      ) : validationError ? (
        <p className="mt-2 text-amber-800">{validationError}</p>
      ) : preview ? (
        <div className="mt-2 space-y-1.5">
          {!unchanged ? (
            <p>
              <span className="text-slate-500">Teraz:</span>{" "}
              <span className="tabular-nums">{previewLine(preview.before)}</span>
            </p>
          ) : null}
          <p>
            {unchanged ? (
              <>
                <span className="text-slate-500">Termin bez zmian:</span>{" "}
                <span className="font-medium tabular-nums text-slate-900">
                  {previewLine(preview.after)}
                </span>
              </>
            ) : (
              <>
                <span className="text-slate-500">Po zapisie:</span>{" "}
                <span className="font-medium tabular-nums text-indigo-900">
                  {previewLine(preview.after)}
                </span>
              </>
            )}
          </p>
        </div>
      ) : null}
    </div>
  );
}
