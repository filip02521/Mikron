"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { useAppShellMetrics } from "@/components/layout/AppShellMetricsContext";
import {
  IconArchive,
  IconChevronRight,
  IconScanLine,
  IconTooth,
  IconWarehouse,
} from "@/components/icons/StrokeIcons";

type FlowStep = {
  id: "weryfikacja" | "kolejka" | "przyjecie" | "historia";
  href: string;
  label: string;
  caption: string;
  icon: ReactNode;
  count?: number;
  /** Kolor licznika, gdy są pozycje do zrobienia. */
  tone: "amber" | "indigo" | "emerald" | "slate";
};

const TONE_BADGE: Record<FlowStep["tone"], string> = {
  amber: "bg-amber-500 text-white",
  indigo: "bg-indigo-600 text-white",
  emerald: "bg-emerald-600 text-white",
  slate: "bg-slate-200 text-slate-700",
};

/**
 * Na telefonie te same etapy są w dolnym pasku nawigacji — tu tylko od md.
 *
 * Pasek procesu działu zębów: zdjęcie → kolejka u dostawcy → przyjęcie → historia.
 * Zastępuje zakładki — od razu widać, na którym etapie są prośby i ile czeka.
 */
export function TeethFlowNav({ className }: { className?: string }) {
  const pathname = usePathname() ?? "";
  const { navBadges } = useAppShellMetrics();

  const steps: FlowStep[] = [
    {
      id: "weryfikacja",
      href: "/zeby/weryfikacja",
      label: "Weryfikacja",
      caption: "Listy ze zdjęć",
      icon: <IconScanLine size={16} strokeWidth={2} />,
      count: navBadges.teethVerification,
      tone: "amber",
    },
    {
      id: "kolejka",
      href: "/zeby/kolejka",
      label: "Do zamówienia",
      caption: "Zamów u dostawcy",
      icon: <IconTooth size={16} />,
      count: navBadges.teethQueue,
      tone: "indigo",
    },
    {
      id: "przyjecie",
      href: "/zeby/przyjecie",
      label: "Przyjęcie",
      caption: "Co dotarło",
      icon: <IconWarehouse size={16} />,
      count: navBadges.teethReceivePending,
      tone: "emerald",
    },
    {
      id: "historia",
      href: "/zeby/historia",
      label: "Historia",
      caption: "Zamówione i dostarczone",
      icon: <IconArchive size={16} strokeWidth={2} />,
      tone: "slate",
    },
  ];

  return (
    <nav
      aria-label="Etapy pracy z zębami"
      className={cn(
        "hidden md:block",
        className,
      )}
    >
      <ol className="flex items-stretch gap-1">
        {steps.map((step, index) => {
          const active = pathname.startsWith(step.href);
          const count = step.count ?? 0;
          return (
            <li key={step.id} className="flex flex-1 items-center gap-1">
              <Link
                href={step.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "group flex min-h-12 flex-1 items-center gap-2.5 rounded-lg border px-3 py-2 transition-colors",
                  active
                    ? "border-indigo-200 bg-white shadow-sm ring-1 ring-indigo-100"
                    : "border-transparent bg-slate-100/70 hover:border-slate-200 hover:bg-white",
                )}
              >
                <span
                  className={cn(
                    "flex size-8 shrink-0 items-center justify-center rounded-md",
                    active ? "bg-indigo-600 text-white" : "bg-white text-slate-500 ring-1 ring-slate-200",
                  )}
                  aria-hidden
                >
                  {step.icon}
                </span>
                <span className="min-w-0 flex-1">
                  <span
                    className={cn(
                      "flex items-center gap-1.5 text-sm font-semibold leading-tight",
                      active ? "text-slate-900" : "text-slate-700",
                    )}
                  >
                    {step.label}
                    {count > 0 ? (
                      <span
                        className={cn(
                          "rounded-full px-1.5 py-px text-[11px] font-bold tabular-nums leading-4",
                          TONE_BADGE[step.tone],
                        )}
                      >
                        {count}
                      </span>
                    ) : null}
                  </span>
                  <span className="hidden text-[11px] leading-tight text-slate-500 lg:block">
                    {step.caption}
                  </span>
                </span>
              </Link>
              {index < steps.length - 1 ? (
                <IconChevronRight
                  size={14}
                  className="text-slate-300"
                />
              ) : null}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
