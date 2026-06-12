"use client";

import { Field, fieldControlClass } from "@/components/ui/Field";
import { MAX_SALES_REQUEST_NOTE_LEN } from "@/lib/security/text-limits";
import { cn } from "@/lib/cn";
import { panelTypography } from "@/lib/ui/ontime-theme";

export function SalesRequestNoteField({
  value,
  onChange,
  disabled,
  className,
  id = "sales-request-note",
  mixedNotesOnLines = false,
  audience = "sales",
}: {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  className?: string;
  id?: string;
  /** Pozycje miały różne uwagi — zapis nadpisze je jedną wspólną notatką. */
  mixedNotesOnLines?: boolean;
  audience?: "sales" | "procurement";
}) {
  const length = value.trim().length;
  const isProcurement = audience === "procurement";

  return (
    <Field
      label={isProcurement ? "Uwagi do prośby" : "Notatka dla zakupów"}
      hint={
        mixedNotesOnLines
          ? "Pozycje miały różne uwagi — wpisanie tutaj ustawi jedną wspólną notatkę dla całej prośby."
          : isProcurement
            ? "Opcjonalnie — widoczna w panelu dziennym przy tej pozycji (np. priorytet, termin, kontekst)."
            : "Opcjonalnie — widoczna w panelu dziennym przy tej prośbie (np. pilne, termin, kontekst dla klienta)."
      }
      className={className}
    >
      {mixedNotesOnLines ? (
        <p className="mb-2 rounded-md border border-amber-200/90 bg-amber-50/70 px-2.5 py-1.5 text-xs leading-snug text-amber-950">
          Rozwiń listę produktów w panelu zakupów, aby zobaczyć dotychczasowe uwagi przy poszczególnych
          pozycjach.
        </p>
      ) : null}
      <textarea
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        rows={3}
        maxLength={MAX_SALES_REQUEST_NOTE_LEN}
        placeholder={
          isProcurement
            ? "Np. priorytet — zamówić w tym tygodniu, potwierdzić termin z dostawcą"
            : "Np. pilne — klient czeka na potwierdzenie terminu w piątek"
        }
        className={fieldControlClass("default", "min-h-[4.5rem] resize-y text-sm leading-snug")}
      />
      <p
        className={cn(
          panelTypography.caption,
          "mt-1 tabular-nums",
          length > MAX_SALES_REQUEST_NOTE_LEN * 0.9 ? "text-amber-700" : "text-slate-400"
        )}
      >
        {length}/{MAX_SALES_REQUEST_NOTE_LEN}
      </p>
    </Field>
  );
}
