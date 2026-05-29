"use client";

import Link from "next/link";
import { cn } from "@/lib/cn";

export type SectionTab<T extends string> = {
  id: T;
  label: string;
  hint: string;
  href: string;
  badgeCount?: number;
};

export function SectionTabNav<T extends string>({
  sectionLabel = "Widok",
  activeTab,
  tabs,
  contextHint,
  ariaLabel,
  className,
}: {
  sectionLabel?: string;
  activeTab: T;
  tabs: SectionTab<T>[];
  contextHint?: string;
  ariaLabel: string;
  className?: string;
}) {
  return (
    <nav className={cn("mb-6 space-y-4", className)} aria-label={ariaLabel}>
      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
          {sectionLabel}
        </p>
        <div
          role="tablist"
          aria-label={ariaLabel}
          className="flex flex-wrap gap-x-1 gap-y-0 border-b border-slate-200"
        >
          {tabs.map((item) => {
            const active = activeTab === item.id;
            return (
              <Link
                key={item.id}
                href={item.href}
                role="tab"
                title={item.hint}
                aria-selected={active}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "-mb-px border-b-2 px-3 py-2.5 text-sm font-medium transition sm:px-4",
                  active
                    ? "border-sky-600 text-sky-800"
                    : "border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-800"
                )}
              >
                {item.label}
                {item.badgeCount != null && item.badgeCount > 0 ? (
                  <span className="ml-1.5 inline-flex min-w-[1.25rem] items-center justify-center rounded-full bg-slate-200 px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-slate-700">
                    {item.badgeCount}
                  </span>
                ) : null}
              </Link>
            );
          })}
        </div>
      </div>

      {contextHint ? (
        <p className="rounded-xl border border-slate-200/90 bg-slate-50/80 px-4 py-3 text-sm leading-relaxed text-slate-600">
          {contextHint}
        </p>
      ) : null}
    </nav>
  );
}
