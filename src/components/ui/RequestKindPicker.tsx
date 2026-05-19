"use client";

import { cn } from "@/lib/cn";
import { choiceChipClass } from "@/lib/ui/surfaces";
import type { IndividualRequestKind } from "@/types/database";

export function RequestKindPicker({
  value,
  onChange,
  compact = false,
  className,
}: {
  value: IndividualRequestKind;
  onChange: (kind: IndividualRequestKind) => void;
  compact?: boolean;
  className?: string;
}) {
  const pad = compact ? choiceChipClass.paddingSm : choiceChipClass.paddingMd;

  return (
    <div className={cn("flex flex-wrap gap-2", className)} role="radiogroup" aria-label="Rodzaj prośby">
      <label className={cn(choiceChipClass.order, pad)}>
        <input
          type="radio"
          name="requestKind"
          className="border-slate-300"
          checked={value === "zamowienie"}
          onChange={() => onChange("zamowienie")}
        />
        Zamówienie
      </label>
      <label className={cn(choiceChipClass.informacja, pad)}>
        <input
          type="radio"
          name="requestKind"
          className="border-slate-300"
          checked={value === "informacja"}
          onChange={() => onChange("informacja")}
        />
        Informacja gdy dotarło
      </label>
    </div>
  );
}
