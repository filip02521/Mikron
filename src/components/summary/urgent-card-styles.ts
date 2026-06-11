import { cn } from "@/lib/cn";

/** Karta harmonogramu — spójna z wierszami Prośb handlowców. */
export function urgentCardClassName(isOverdue = false) {
  return cn(
    "rounded-md border border-slate-200 bg-white transition-shadow hover:border-slate-300",
    isOverdue && "border-amber-300/90 bg-amber-50/35"
  );
}

export function urgentGroupHeadingClassName(isOverdue = false) {
  return cn(
    "shrink-0 text-xs font-semibold uppercase tracking-wide",
    isOverdue ? "text-slate-600" : "text-slate-500"
  );
}

export function urgentGroupDividerClassName(isOverdue = false) {
  void isOverdue;
  return "h-px flex-1 bg-slate-200";
}

export function urgentStatusBadgeVariant(
  isOverdue: boolean
): "warning" | "info" {
  return isOverdue ? "warning" : "info";
}
