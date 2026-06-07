"use client";

import { useState } from "react";
import { cn } from "@/lib/cn";

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
        "group rounded-md border border-slate-200/90 bg-slate-50/40 sm:col-span-2",
        className
      )}
    >
      <summary className="cursor-pointer list-none px-3 py-2.5 marker:content-none sm:px-4">
        <span className="flex items-center justify-between gap-2">
          <span>
            <span className="block text-xs font-semibold uppercase tracking-wide text-slate-700">
              {title}
            </span>
            {description ? (
              <span className="mt-0.5 block text-xs font-normal normal-case tracking-normal text-slate-500">
                {description}
              </span>
            ) : null}
          </span>
          <span
            className="shrink-0 text-slate-400 transition group-open:rotate-180"
            aria-hidden
          >
            ▾
          </span>
        </span>
      </summary>
      <div className="grid gap-4 border-t border-slate-100 px-3 pb-4 pt-3 sm:grid-cols-2 sm:px-4">
        {children}
      </div>
    </details>
  );
}
