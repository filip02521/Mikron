"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { Badge } from "@/components/ui/Badge";
import { notatnikCollapsibleClass } from "./notatnik-layout";

export function NotatnikCollapsible({
  title,
  description,
  count,
  open,
  onToggle,
  children,
  className,
  highlight,
  badge,
}: {
  title: string;
  description?: string;
  count?: number;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
  className?: string;
  highlight?: boolean;
  badge?: ReactNode;
}) {
  const label = count != null && count > 0 ? `${title} (${count})` : title;

  return (
    <section
      className={notatnikCollapsibleClass(
        cn(highlight && !open && "ring-1 ring-amber-200/90", className)
      )}
    >
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition hover:bg-slate-50/80"
      >
        <div className="flex min-w-0 flex-1 items-start gap-2">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-sm font-semibold tracking-tight text-slate-900">{label}</h2>
              {badge && !open ? badge : null}
            </div>
            {description && !open ? (
              <p className="mt-0.5 truncate text-xs text-slate-500">{description}</p>
            ) : null}
          </div>
        </div>
        <span
          className={cn(
            "shrink-0 text-xs font-medium text-slate-400 transition-transform duration-200",
            open && "rotate-180"
          )}
          aria-hidden
        >
          ▼
        </span>
      </button>
      {open ? <div className="border-t border-slate-100 p-4">{children}</div> : null}
    </section>
  );
}
