import { cn } from "@/lib/cn";

/** Karta harmonogramu — jak prośby handlowców; zaległe z delikatnym bursztynem. */
export function urgentCardClassName(isOverdue = false) {
  return cn(
    "rounded-xl border bg-white shadow-sm transition",
    isOverdue
      ? "border-amber-200/80 hover:border-amber-300/90"
      : "border-slate-200 hover:border-slate-300"
  );
}

export function urgentGroupHeadingClassName(isOverdue = false) {
  return cn(
    "shrink-0 text-xs font-semibold uppercase tracking-wide",
    isOverdue ? "text-amber-800" : "text-slate-500"
  );
}

export function urgentGroupDividerClassName(isOverdue = false) {
  return cn("h-px flex-1", isOverdue ? "bg-amber-200/70" : "bg-slate-200");
}

export function urgentStatusBadgeVariant(
  isOverdue: boolean
): "warning" | "info" {
  return isOverdue ? "warning" : "info";
}
