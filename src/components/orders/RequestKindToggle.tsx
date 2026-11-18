"use client";

import type { IndividualRequestKind } from "@/types/database";
import { cn } from "@/lib/cn";
import { IconAvailability, IconTruck } from "@/components/icons/StrokeIcons";

export function RequestKindToggle({
  value,
  onChange,
  disabled = false,
}: {
  value: IndividualRequestKind;
  onChange: (kind: IndividualRequestKind) => void;
  disabled?: boolean;
}) {
  return (
    <div
      className={cn("grid gap-2 sm:grid-cols-2", disabled && "pointer-events-none opacity-60")}
      role="radiogroup"
      aria-label="Rodzaj prośby"
      aria-disabled={disabled || undefined}
    >
      <button
        type="button"
        role="radio"
        aria-checked={value === "zamowienie"}
        disabled={disabled}
        onClick={() => onChange("zamowienie")}
        className={cn(
          "flex min-h-[4.5rem] cursor-pointer items-start gap-3 rounded-md border px-3.5 py-3 text-left transition-shadow",
          value === "zamowienie"
            ? "border-indigo-400 bg-indigo-50/90 shadow-sm ring-2 ring-indigo-400/30"
            : "border-slate-200 bg-card hover:border-slate-300 hover:bg-slate-50/80"
        )}
      >
        <IconTruck
          size={18}
          aria-hidden
          className={cn("mt-0.5 shrink-0", value === "zamowienie" ? "text-indigo-700" : "text-slate-500")}
        />
        <span className="min-w-0">
          <span className="block text-sm font-semibold text-slate-900">Zamówienie u dostawcy</span>
          <span className="mt-0.5 block text-xs leading-relaxed text-slate-600">
            Składamy zamówienie - podajesz ilość i śledzisz dostawę.
          </span>
        </span>
      </button>

      <button
        type="button"
        role="radio"
        aria-checked={value === "informacja"}
        disabled={disabled}
        onClick={() => onChange("informacja")}
        className={cn(
          "flex min-h-[4.5rem] cursor-pointer items-start gap-3 rounded-md border px-3.5 py-3 text-left transition-shadow",
          value === "informacja"
            ? "border-violet-400 bg-violet-50/90 shadow-sm ring-2 ring-violet-400/30"
            : "border-slate-200 bg-card hover:border-slate-300 hover:bg-slate-50/80"
        )}
      >
        <IconAvailability
          size={18}
          aria-hidden
          className={cn("mt-0.5 shrink-0", value === "informacja" ? "text-violet-700" : "text-slate-500")}
        />
        <span className="min-w-0">
          <span className="block text-sm font-semibold text-slate-900">
            Informacja o towarze
          </span>
          <span className="mt-0.5 block text-xs leading-relaxed text-slate-600">
            Wybierz ścieżkę poniżej - powiadomienie o stanie magazynowym albo brak na stanie.
          </span>
        </span>
      </button>
    </div>
  );
}

/**
 * Formularz handlowca: dwa rodzaje prośby wprost, bez drugiego wyboru ścieżki pod „Informacją o towarze”.
 * Brak na stanie zgłasza się z karty „Dostępność” przy pozycji — to nie jest rodzaj prośby.
 */
export type SalesRequestChoice = "zamowienie" | "powiadom";

const SALES_CHOICES: {
  id: SalesRequestChoice;
  title: string;
  body: string;
  Icon: typeof IconTruck;
  active: string;
  activeIcon: string;
}[] = [
  {
    id: "zamowienie",
    title: "Zamówienie u dostawcy",
    body: "Dla klienta - podajesz ilość i śledzisz dostawę.",
    Icon: IconTruck,
    active: "border-indigo-400 bg-indigo-50/90 ring-indigo-400/30",
    activeIcon: "text-indigo-700",
  },
  {
    id: "powiadom",
    title: "Powiadom, gdy będzie",
    body: "Obserwujemy stan magazynu i wyślemy Ci e-mail, gdy towar się pojawi.",
    Icon: IconAvailability,
    active: "border-violet-400 bg-violet-50/90 ring-violet-400/30",
    activeIcon: "text-violet-700",
  },
];

export function SalesRequestChoiceToggle({
  value,
  onChange,
  disabled = false,
}: {
  value: SalesRequestChoice;
  onChange: (choice: SalesRequestChoice) => void;
  disabled?: boolean;
}) {
  return (
    <div
      className={cn("grid gap-2 sm:grid-cols-2", disabled && "pointer-events-none opacity-60")}
      role="radiogroup"
      aria-label="Rodzaj prośby"
      aria-disabled={disabled || undefined}
    >
      {SALES_CHOICES.map(({ id, title, body, Icon, active, activeIcon }) => (
        <button
          key={id}
          type="button"
          role="radio"
          aria-checked={value === id}
          disabled={disabled}
          onClick={() => onChange(id)}
          className={cn(
            "flex min-h-[4.5rem] cursor-pointer items-start gap-3 rounded-md border px-3.5 py-3 text-left transition-shadow",
            value === id ? cn(active, "shadow-sm ring-2") : "border-slate-200 bg-card hover:border-slate-300 hover:bg-slate-50/80"
          )}
        >
          <Icon size={18} aria-hidden className={cn("mt-0.5 shrink-0", value === id ? activeIcon : "text-slate-500")} />
          <span className="min-w-0">
            <span className="block text-sm font-semibold text-slate-900">{title}</span>
            <span className="mt-0.5 block text-xs leading-relaxed text-slate-600">{body}</span>
          </span>
        </button>
      ))}
    </div>
  );
}
