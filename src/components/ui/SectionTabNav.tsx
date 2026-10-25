"use client";

import Link from "next/link";
import { cn } from "@/lib/cn";
import { controlFocusClass } from "@/lib/ui/ontime-theme";

export type SectionTab<T extends string> = {
  id: T;
  label: string;
  hint: string;
  href: string;
  badgeCount?: number;
};

/** Zakładki strony (hub): linki na linii, wybrana z podkreśleniem Petrol — DESIGN.md → Navigation. */
export function SectionTabNav<T extends string>({
  activeTab,
  tabs,
  contextHint,
  ariaLabel,
  className,
  embedded = false,
}: {
  /** @deprecated Zakładki nie mają etykiety nad sobą; nazwę niesie `ariaLabel`. */
  sectionLabel?: string;
  activeTab: T;
  tabs: SectionTab<T>[];
  contextHint?: string;
  ariaLabel: string;
  className?: string;
  /** Wewnątrz większego bloku — bez dolnego marginesu strony. */
  embedded?: boolean;
}) {
  return (
    <nav className={cn(embedded ? "space-y-3" : "mb-5 space-y-3", className)} aria-label={ariaLabel}>
      <div
        role="tablist"
        aria-label={ariaLabel}
        className="flex gap-5 overflow-x-auto border-b border-slate-200 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:gap-6"
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
                "-mb-px inline-flex min-h-11 shrink-0 items-center gap-1.5 border-b-2 px-0.5 text-sm font-medium transition-colors duration-150 sm:min-h-10",
                controlFocusClass,
                active
                  ? "border-indigo-600 text-slate-900"
                  : "border-transparent text-slate-600 hover:border-slate-300 hover:text-slate-900"
              )}
            >
              {item.label}
              {item.badgeCount != null && item.badgeCount > 0 ? (
                <span className="inline-flex min-w-[1.25rem] items-center justify-center rounded-md bg-slate-100 px-1.5 py-0.5 text-[0.625rem] font-semibold tabular-nums text-slate-600">
                  {item.badgeCount}
                </span>
              ) : null}
            </Link>
          );
        })}
      </div>

      {contextHint ? (
        <p className="rounded-md bg-slate-50 px-4 py-3 text-sm leading-relaxed text-slate-600">{contextHint}</p>
      ) : null}
    </nav>
  );
}
