"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export function DailyPanelSection({
  id,
  step,
  title,
  description,
  children,
  className,
}: {
  id: string;
  step: number;
  title: string;
  description?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section id={id} className={cn("scroll-mt-20", className)}>
      <div className="mb-4 border-b border-slate-100 pb-3">
        <p className="text-xs font-medium text-slate-500">
          Krok {step}
        </p>
        <h2 className="mt-0.5 text-lg font-semibold text-slate-900">{title}</h2>
        {description ? (
          <p className="mt-1 max-w-3xl text-sm text-slate-500">{description}</p>
        ) : null}
      </div>
      <div className="space-y-4">{children}</div>
    </section>
  );
}
