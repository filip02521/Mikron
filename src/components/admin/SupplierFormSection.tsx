"use client";

import { useState } from "react";
import { cn } from "@/lib/cn";
import { IconChevronDown } from "@/components/icons/StrokeIcons";

export function SupplierFormSection({
  title,
  description,
  defaultOpen = false,
  children,
  className,
}: {
  title: string;
  description?: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
  className?: string;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <details
      open={open}
      onToggle={(e) => setOpen(e.currentTarget.open)}
      className={cn(
        "group rounded-lg border border-slate-200/70 bg-slate-50/40 transition-colors hover:border-slate-300/60 sm:col-span-2",
        className
      )}
    >
      <summary className="cursor-pointer list-none px-4 py-3 marker:content-none transition-colors hover:bg-slate-50/80">
        <span className="flex items-center justify-between gap-2">
          <span>
            <span className="block text-xs font-semibold uppercase tracking-wide text-slate-600">
              {title}
            </span>
            {description ? (
              <span className="mt-0.5 block text-xs font-normal normal-case tracking-normal text-slate-400">
                {description}
              </span>
            ) : null}
          </span>
          <span
            className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-slate-400 transition-transform duration-200 group-open:rotate-180"
            aria-hidden
          >
            <IconChevronDown size={15} />
          </span>
        </span>
      </summary>
      <div className="grid gap-4 border-t border-slate-100 px-4 pb-4 pt-3 sm:grid-cols-2">
        {children}
      </div>
    </details>
  );
}
