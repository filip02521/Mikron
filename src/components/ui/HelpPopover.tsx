"use client";

import { useEffect, useId, useRef, useState } from "react";
import { IconColorLegendSample, IconHelpCircle } from "@/components/icons/StrokeIcons";
import { cn } from "@/lib/cn";

export function HelpPopover({
  label,
  title,
  shortLabel,
  icon,
  children,
  align = "right",
  className,
  buttonClassName,
}: {
  label: string;
  title: string;
  /** Widoczny tekst na przycisku (zamiast samego „?”). */
  shortLabel: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
  align?: "left" | "right";
  className?: string;
  buttonClassName?: string;
}) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const generatedId = useId();
  /** useId bywa niespójny między SSR a klientem przy różnej liczbie instancji w drzewie — ustawiamy po mount. */
  const panelId = mounted ? generatedId : undefined;

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onPointer = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={rootRef} className={cn("relative inline-flex", className)}>
      <button
        type="button"
        aria-label={label}
        aria-expanded={open}
        aria-controls={open && panelId ? panelId : undefined}
        title={label}
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "inline-flex cursor-pointer items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs font-medium shadow-sm transition",
          open
            ? "border-indigo-300 bg-indigo-50 text-indigo-800"
            : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50",
          buttonClassName
        )}
      >
        {icon ? (
          <span className="flex shrink-0 text-slate-500" aria-hidden>
            {icon}
          </span>
        ) : null}
        <span>{shortLabel}</span>
      </button>

      {open && panelId ? (
        <div
          id={panelId}
          role="dialog"
          aria-label={title}
          className={cn(
            "absolute top-full z-50 mt-2 max-h-[min(70vh,28rem)] w-[min(100vw-2rem,24rem)] overflow-y-auto rounded-md border border-slate-200 bg-white p-4 text-sm text-slate-600 shadow-lg overscroll-contain",
            align === "right" ? "right-0" : "left-0"
          )}
        >
          <p className="mb-3 text-sm font-semibold text-slate-900">{title}</p>
          {children}
        </div>
      ) : null}
    </div>
  );
}

/** @deprecated Użyj IconHelpCircle z StrokeIcons. */
export function GuideIcon({ className }: { className?: string }) {
  return <IconHelpCircle size={14} strokeWidth={1.75} className={className} aria-hidden />;
}

/** @deprecated Użyj IconColorLegendSample z StrokeIcons. */
export function LegendIcon({ className }: { className?: string }) {
  return <IconColorLegendSample size={14} className={className} />;
}
