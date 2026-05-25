"use client";

import type { IndividualRequestKind } from "@/types/database";
import { cn } from "@/lib/cn";
import { IconAvailability, IconTruck } from "@/components/icons/StrokeIcons";
import { SectionHeadingIcon } from "@/components/icons/SectionHeadingIcon";

export function RequestKindToggle({
  value,
  onChange,
}: {
  value: IndividualRequestKind;
  onChange: (kind: IndividualRequestKind) => void;
}) {
  return (
    <div className="grid gap-2 sm:grid-cols-2" role="radiogroup" aria-label="Rodzaj prośby">
      <button
        type="button"
        role="radio"
        aria-checked={value === "zamowienie"}
        onClick={() => onChange("zamowienie")}
        className={cn(
          "flex min-h-[4.5rem] cursor-pointer items-start gap-3 rounded-xl border px-3.5 py-3 text-left transition-shadow",
          value === "zamowienie"
            ? "border-indigo-400 bg-indigo-50/90 shadow-sm ring-2 ring-indigo-400/30"
            : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/80"
        )}
      >
        <SectionHeadingIcon
          tileClassName={
            value === "zamowienie"
              ? "bg-indigo-200/80 text-indigo-900"
              : "bg-slate-100 text-slate-600"
          }
          className="h-9 w-9"
        >
          <IconTruck size={18} />
        </SectionHeadingIcon>
        <span className="min-w-0 pt-0.5">
          <span className="block text-sm font-semibold text-slate-900">Zamówienie u dostawcy</span>
          <span className="mt-0.5 block text-xs leading-relaxed text-slate-600">
            Składamy zamówienie — podajesz ilość i śledzisz dostawę.
          </span>
        </span>
      </button>

      <button
        type="button"
        role="radio"
        aria-checked={value === "informacja"}
        onClick={() => onChange("informacja")}
        className={cn(
          "flex min-h-[4.5rem] cursor-pointer items-start gap-3 rounded-xl border px-3.5 py-3 text-left transition-shadow",
          value === "informacja"
            ? "border-violet-400 bg-violet-50/90 shadow-sm ring-2 ring-violet-400/30"
            : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/80"
        )}
      >
        <SectionHeadingIcon
          tileClassName={
            value === "informacja"
              ? "bg-violet-200/80 text-violet-900"
              : "bg-slate-100 text-slate-600"
          }
          className="h-9 w-9"
        >
          <IconAvailability size={18} />
        </SectionHeadingIcon>
        <span className="min-w-0 pt-0.5">
          <span className="block text-sm font-semibold text-slate-900">
            Tylko dostępność na magazynie
          </span>
          <span className="mt-0.5 block text-xs leading-relaxed text-slate-600">
            Bez zamówienia u dostawcy — powiadomimy, gdy towar będzie.
          </span>
        </span>
      </button>
    </div>
  );
}
