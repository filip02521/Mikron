"use client";

import { IconSearch } from "@/components/icons/StrokeIcons";
import { cn } from "@/lib/cn";
import { controlFocusClass } from "@/lib/ui/ontime-theme";
import {
  queueToolbarFieldLabelClass,
  queueToolbarInputClass,
} from "@/lib/ui/queue-panel-styles";

export function DeliveryJournalSearchField({
  id,
  label,
  value,
  placeholder,
  hint,
  disabled,
  onChange,
  onSubmit,
  className,
}: {
  id: string;
  label: string;
  value: string;
  placeholder: string;
  hint?: string;
  disabled?: boolean;
  onChange: (value: string) => void;
  onSubmit?: () => void;
  className?: string;
}) {
  return (
    <label className={cn("min-w-0 flex-1", className)} htmlFor={id}>
      <span className={queueToolbarFieldLabelClass}>{label}</span>
      <div className="relative">
        <IconSearch
          size={15}
          className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400"
          aria-hidden
        />
        <input
          id={id}
          type="text"
          role="searchbox"
          value={value}
          disabled={disabled}
          placeholder={placeholder}
          autoComplete="off"
          enterKeyHint="search"
          aria-describedby={hint ? `${id}-hint` : undefined}
          className={cn(
            queueToolbarInputClass,
            controlFocusClass,
            "w-full py-2 pl-8",
            value ? "pr-10" : "pr-3"
          )}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && onSubmit) {
              e.preventDefault();
              onSubmit();
            }
            if (e.key === "Escape" && value) {
              e.preventDefault();
              onChange("");
            }
          }}
        />
        {value ? (
          <button
            type="button"
            disabled={disabled}
            aria-label="Wyczyść wyszukiwanie"
            className="absolute right-1 top-1/2 flex size-7 -translate-y-1/2 items-center justify-center rounded-md text-base leading-none text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:opacity-50"
            onClick={() => onChange("")}
          >
            ×
          </button>
        ) : null}
      </div>
      {hint ? (
        <p id={`${id}-hint`} className="mt-1 text-[11px] leading-snug text-slate-500">
          {hint}
        </p>
      ) : null}
    </label>
  );
}
