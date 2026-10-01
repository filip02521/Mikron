"use client";

import { IconPlusCircle, IconToothShortage } from "@/components/icons/StrokeIcons";
import { TEETH_BRAKI_ADD_COPY } from "@/components/zeby/teeth-panel-copy";
import { cn } from "@/lib/cn";

/** Ilustracja pustego stanu listy braków — ząb + badge ostrzeżenia + plus. */
export function TeethShortageEmptyGraphic({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "relative mx-auto flex h-[4.5rem] w-[4.5rem] items-center justify-center",
        className,
      )}
      aria-hidden
    >
      <span className="relative flex size-12 items-center justify-center rounded-xl bg-indigo-600 text-white ring-1 ring-indigo-400/40">
        <IconToothShortage size={26} strokeWidth={1.75} />
      </span>
      <span className="absolute -bottom-0.5 -right-0.5 flex size-7 items-center justify-center rounded-full bg-white text-neutral-700 shadow-sm ring-1 ring-neutral-200">
        <IconPlusCircle size={16} strokeWidth={2.25} />
      </span>
    </div>
  );
}

export function TeethShortageAddCta({
  onClick,
  disabled,
  compact = false,
  label = TEETH_BRAKI_ADD_COPY.ctaLabel,
}: {
  onClick: () => void;
  disabled?: boolean;
  /** Węższy wariant w nagłówku karty. */
  compact?: boolean;
  label?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "group relative inline-flex items-center overflow-hidden rounded-md text-left",
        "bg-indigo-600 text-white",
        "ring-1 ring-indigo-400/35",
        "transition-[filter,transform] hover:brightness-[1.03] active:scale-[0.98]",
        "disabled:pointer-events-none disabled:opacity-50",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 focus-visible:ring-offset-2",
        compact ? "h-10 gap-2 px-2.5 sm:gap-2.5 sm:px-3" : "gap-3 px-4 py-2.5",
      )}
    >
      <span
        className={cn(
          "relative flex shrink-0 items-center justify-center rounded-md bg-white/20 ring-1 ring-white/30",
          compact ? "size-7" : "size-9",
        )}
      >
        <IconToothShortage size={compact ? 16 : 18} strokeWidth={1.85} />
        <span
          className={cn(
            "absolute -bottom-1 -right-1 flex items-center justify-center rounded-full bg-white text-indigo-700 shadow-sm ring-1 ring-neutral-200",
            compact ? "size-3.5" : "size-4",
          )}
        >
          <IconPlusCircle size={compact ? 10 : 11} strokeWidth={2.5} />
        </span>
      </span>
      <span className="relative flex min-w-0 flex-col leading-tight">
        <span
          className={cn(
            "font-semibold tracking-tight",
            compact ? "text-xs" : "text-sm",
          )}
        >
          {label}
        </span>
        {compact ? (
          <span className="hidden text-[10px] font-medium text-indigo-50/90 sm:block">
            {TEETH_BRAKI_ADD_COPY.ctaHint}
          </span>
        ) : (
          <span className="mt-0.5 text-[11px] font-medium text-indigo-50/90">
            {TEETH_BRAKI_ADD_COPY.ctaHint}
          </span>
        )}
      </span>
    </button>
  );
}
