import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { notatnikPanelClass } from "./notatnik-layout";

export function NotatnikPanel({
  title,
  description,
  meta,
  children,
  className,
  bodyClassName,
}: {
  title: string;
  description?: string;
  meta?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <section className={notatnikPanelClass(className)}>
      <header className="flex items-start justify-between gap-3 border-b border-slate-100 px-4 py-3">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold tracking-tight text-slate-900">{title}</h2>
          {description ? (
            <p className="mt-0.5 text-xs leading-snug text-slate-500">{description}</p>
          ) : null}
        </div>
        {meta ? <div className="shrink-0 text-xs text-slate-500">{meta}</div> : null}
      </header>
      <div className={cn("p-4", bodyClassName)}>{children}</div>
    </section>
  );
}
