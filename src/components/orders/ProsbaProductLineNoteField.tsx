"use client";

import { fieldControlClass } from "@/components/ui/Field";
import { ProsbaOptionalSection } from "@/components/orders/ProsbaOptionalSection";
import { PROSBA_OPTIONAL_SECTION_COPY } from "@/lib/orders/prosba-optional-section-copy";
import { MAX_SALES_REQUEST_NOTE_LEN } from "@/lib/security/text-limits";
import { cn } from "@/lib/cn";
import { panelTypography } from "@/lib/ui/ontime-theme";

export function ProsbaProductLineNoteField({
  value,
  onChange,
  disabled,
  id,
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  id: string;
  className?: string;
}) {
  const hasNote = value.trim().length > 0;
  const length = value.trim().length;
  const copy = PROSBA_OPTIONAL_SECTION_COPY.lineNote;

  return (
    <ProsbaOptionalSection
      kind="line-note"
      title={copy.title}
      description={copy.description}
      defaultOpen={hasNote}
      detailsKey={hasNote ? "note-open" : "note-collapsed"}
      teaser={hasNote ? value.trim() : null}
      className={className}
    >
      <textarea
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        rows={2}
        maxLength={MAX_SALES_REQUEST_NOTE_LEN}
        placeholder="Np. pilne — klient czeka na potwierdzenie terminu w piątek"
        className={fieldControlClass("default", "min-h-[3.25rem] resize-y text-sm leading-snug")}
      />
      {hasNote ? (
        <p
          className={cn(
            panelTypography.caption,
            "mt-1 tabular-nums",
            length > MAX_SALES_REQUEST_NOTE_LEN * 0.9 ? "text-amber-700" : "text-slate-400"
          )}
        >
          {length}/{MAX_SALES_REQUEST_NOTE_LEN}
        </p>
      ) : null}
    </ProsbaOptionalSection>
  );
}
