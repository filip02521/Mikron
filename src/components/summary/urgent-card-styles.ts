import { cn } from "@/lib/cn";

/** Wspólna baza kart harmonogramu (zaległe / na dziś) — jak prośby handlowców. */
export const URGENT_CARD_BASE =
  "rounded-xl border border-[var(--card-border)] bg-[var(--card)] shadow-[var(--shadow-card)]";

export function urgentCardClassName(overdue: boolean) {
  return cn(
    URGENT_CARD_BASE,
    overdue
      ? "border-rose-200/90 bg-rose-50/55 ring-1 ring-rose-100/70"
      : "border-slate-200/90"
  );
}

export function urgentGroupHeadingClassName(overdue: boolean) {
  return cn(
    "shrink-0 text-xs font-semibold uppercase tracking-wide",
    overdue ? "text-rose-800/90" : "text-slate-500"
  );
}

export function urgentGroupDividerClassName(overdue: boolean) {
  return cn("h-px flex-1", overdue ? "bg-rose-200/80" : "bg-slate-200");
}
