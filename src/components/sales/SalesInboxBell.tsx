"use client";

import { IconBell } from "@/components/icons/StrokeIcons";
import { useSalesInbox } from "@/components/sales/SalesInboxContext";
import { SALES_INBOX_PANEL_ID } from "@/components/sales/SalesInboxPanel";
import { cn } from "@/lib/cn";
import { controlFocusClass } from "@/lib/ui/ontime-theme";

export function SalesInboxBellTrigger({
  className,
  size = "md",
}: {
  className?: string;
  size?: "md" | "lg";
}) {
  const inbox = useSalesInbox();
  if (!inbox?.visible) return null;

  const { count, open, setOpen, ringing } = inbox;
  const showBadge = count > 0;
  const iconSize = size === "lg" ? 24 : 20;
  const buttonSize = size === "lg" ? "h-12 w-12" : "h-10 w-10";

  return (
    <button
      type="button"
      aria-label={
        showBadge
          ? `Pilne sprawy: ${count}. Otwórz panel powiadomień.`
          : "Brak pilnych spraw. Otwórz panel powiadomień."
      }
      aria-expanded={open}
      aria-controls={SALES_INBOX_PANEL_ID}
      onClick={() => setOpen(!open)}
      className={cn(
        "relative inline-flex shrink-0 cursor-pointer items-center justify-center rounded-full border border-slate-200/90 bg-white text-slate-700 shadow-sm transition hover:border-indigo-200 hover:bg-indigo-50/40 hover:text-indigo-800",
        buttonSize,
        controlFocusClass,
        ringing && "sales-bell-ring",
        className
      )}
    >
      <IconBell size={iconSize} strokeWidth={2} />
      {showBadge ? (
        <span
          className={cn(
            "absolute -right-1 -top-1 flex min-h-[1.125rem] min-w-[1.125rem] items-center justify-center rounded-full bg-indigo-600 px-1 text-[10px] font-bold leading-none text-white ring-2 ring-white",
            ringing && "animate-pulse"
          )}
        >
          {count > 99 ? "99+" : count}
        </span>
      ) : null}
    </button>
  );
}

/** Desktop: stały dzwonek w prawym górnym rogu. */
export function SalesInboxFloatingBell() {
  return (
    <div className="pointer-events-none fixed right-4 top-4 z-[45] hidden md:block">
      <div className="pointer-events-auto">
        <SalesInboxBellTrigger size="lg" />
      </div>
    </div>
  );
}
