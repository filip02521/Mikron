import { cn } from "@/lib/cn";
import { surfaceCardClass } from "@/lib/ui/ontime-theme";

/** Karta harmonogramu — ton pilności bez lewego paska. */
export function urgentCardClassName(isOverdue = false) {
  return cn(
    surfaceCardClass,
    "shadow-[var(--shadow-card)] transition-shadow hover:shadow-[var(--shadow-card-elevated)]",
    isOverdue
      ? "border-amber-200/85 bg-amber-50/25 hover:border-amber-200/90"
      : "border-sky-200/75 bg-sky-50/10 hover:border-sky-200/85"
  );
}

export function urgentGroupHeadingClassName(isOverdue = false) {
  return cn(
    "shrink-0 text-xs font-semibold uppercase tracking-wide",
    isOverdue ? "text-amber-800/80" : "text-sky-800/70"
  );
}

export function urgentGroupDividerClassName(isOverdue = false) {
  return cn("h-px flex-1", isOverdue ? "bg-amber-200/70" : "bg-sky-200/60");
}

export function urgentStatusBadgeVariant(
  isOverdue: boolean
): "warning" | "info" {
  return isOverdue ? "warning" : "info";
}
