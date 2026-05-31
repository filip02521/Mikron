import { SUMMARY_COLORS } from "@/types/database";

export const LEGEND_ITEMS = [
  { label: "Po terminie", color: SUMMARY_COLORS.expired },
  { label: "Dziś", color: SUMMARY_COLORS.today },
  { label: "Jutro", color: SUMMARY_COLORS.tomorrow },
  { label: "Ten tydzień", color: SUMMARY_COLORS.thisWeek },
  { label: "Prośba handlowca", color: SUMMARY_COLORS.forSomeone },
] as const;

export function ColorLegendContent() {
  return (
    <ul className="space-y-2">
      {LEGEND_ITEMS.map((item) => (
        <li key={item.label} className="flex items-center gap-2 text-sm">
          <span
            className="h-3.5 w-3.5 shrink-0 rounded-sm border border-slate-200/60"
            style={{ backgroundColor: item.color }}
            aria-hidden
          />
          <span className="text-slate-700">{item.label}</span>
        </li>
      ))}
    </ul>
  );
}

/** Pełna legenda (np. harmonogramy) — opcjonalnie zwinięta. */
export function ColorLegend({ className = "" }: { className?: string }) {
  return (
    <details className={`group rounded-md border border-slate-200/90 bg-white ${className}`}>
      <summary className="cursor-pointer list-none px-3 py-2 text-xs font-semibold text-slate-600 marker:content-none [&::-webkit-details-marker]:hidden">
        <span className="inline-flex items-center gap-1.5">
          <span className="flex h-5 w-5 items-center justify-center rounded-full border border-slate-200 text-[10px] font-bold text-slate-500">
            ?
          </span>
          Legenda kolorów
        </span>
      </summary>
      <div className="border-t border-slate-100 px-3 py-2">
        <ColorLegendContent />
      </div>
    </details>
  );
}
