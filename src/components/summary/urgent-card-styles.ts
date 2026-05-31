import { cn } from "@/lib/cn";

/** Karta harmonogramu — neutralna obudowa; zaległe tylko cienkim akcentem. */
export function urgentCardClassName(isOverdue = false) {
  return cn(
    "rounded-md border bg-white transition",
    isOverdue
      ? "border-slate-200 border-l-2 border-l-amber-400 hover:border-slate-300"
      : "border-slate-200 hover:border-slate-300"
  );
}

export function urgentGroupHeadingClassName(isOverdue = false) {
  return cn(
    "shrink-0 text-xs font-semibold uppercase tracking-wide",
    isOverdue ? "text-slate-600" : "text-slate-500"
  );
}

export function urgentGroupDividerClassName(_isOverdue = false) {
  return "h-px flex-1 bg-slate-200";
}

export function urgentStatusBadgeVariant(
  isOverdue: boolean
): "warning" | "info" {
  return isOverdue ? "warning" : "info";
}
