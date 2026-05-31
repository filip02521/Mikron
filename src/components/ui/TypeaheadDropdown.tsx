"use client";

import { cn } from "@/lib/cn";

export function TypeaheadDropdown({
  open,
  children,
  className,
  emptyMessage,
}: {
  open: boolean;
  children: React.ReactNode;
  className?: string;
  emptyMessage?: string;
}) {
  if (!open) return null;

  return (
    <ul
      role="listbox"
      className={cn(
        "absolute z-50 mt-1 max-h-64 w-full overflow-auto rounded-md border border-slate-200 bg-white py-1 shadow-lg",
        className
      )}
    >
      {children}
      {emptyMessage ? (
        <li className="px-3 py-2 text-sm text-slate-500">{emptyMessage}</li>
      ) : null}
    </ul>
  );
}

export function TypeaheadSectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <li className="px-3 pb-0.5 pt-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">
      {children}
    </li>
  );
}

export function TypeaheadOption({
  onSelect,
  title,
  subtitle,
  badge,
}: {
  onSelect: () => void;
  title: string;
  subtitle?: string;
  badge?: string;
}) {
  return (
    <li role="option">
      <button
        type="button"
        className="flex w-full cursor-pointer flex-col gap-0.5 px-3 py-2 text-left text-sm hover:bg-indigo-50/80 focus:bg-indigo-50/80 focus:outline-none"
        onMouseDown={(e) => e.preventDefault()}
        onClick={onSelect}
      >
        <span className="flex items-start justify-between gap-2">
          <span className="font-medium text-slate-900">{title}</span>
          {badge ? (
            <span className="shrink-0 rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600">
              {badge}
            </span>
          ) : null}
        </span>
        {subtitle ? <span className="text-xs text-slate-500">{subtitle}</span> : null}
      </button>
    </li>
  );
}
