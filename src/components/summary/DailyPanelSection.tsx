"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export function DailyPanelSection({
  id,
  step: _step,
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
        <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
        {description ? (
          <p className="mt-1 max-w-3xl text-sm text-slate-500">{description}</p>
        ) : null}
      </div>
      <div className="space-y-4">{children}</div>
    </section>
  );
}
