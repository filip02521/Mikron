"use client";

import { useState, type ReactNode } from "react";
import { cn } from "@/lib/cn";
import { IconChevronDown } from "@/components/icons/StrokeIcons";

/**
 * Zbiera miękkie ostrzeżenia w jeden collapsible.
 * Blokery Create NIGDY tu nie wrzucamy — zostają pełnymi Alertami.
 */
export function ZdEstimateAlertBucket({
  items,
  title = "Inne uwagi",
  defaultOpen = false,
  className,
}: {
  items: readonly ReactNode[];
  title?: string;
  /** Otwórz od razu, gdy soft alerts mają CTA / wymagają uwagi. */
  defaultOpen?: boolean;
  className?: string;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const visible = items.filter(Boolean);
  const n = visible.length;
  if (n === 0) return null;

  if (n === 1) {
    return <div className={className}>{visible[0]}</div>;
  }

  return (
    <div
      className={cn(
        "rounded-xl border border-slate-200/90 bg-slate-50/80",
        className
      )}
    >
      <button
        type="button"
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left text-sm font-semibold text-slate-800 transition hover:bg-slate-100/80"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <span>
          {title} ({n})
        </span>
        <IconChevronDown
          size={16}
          strokeWidth={1.75}
          className={cn(
            "shrink-0 text-slate-500 transition-transform",
            open && "rotate-180"
          )}
        />
      </button>
      {open ? (
        <div className="space-y-3 border-t border-slate-200/80 px-3 pb-3 pt-3 sm:px-4">
          {visible.map((item, i) => (
            <div key={i}>{item}</div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
