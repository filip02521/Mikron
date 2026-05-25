"use client";

import { useEffect, useId, useRef, useState } from "react";
import { cn } from "@/lib/cn";

export function HelpPopover({
  label,
  title,
  shortLabel,
  icon,
  children,
  align = "right",
  className,
}: {
  label: string;
  title: string;
  /** Widoczny tekst na przycisku (zamiast samego „?”). */
  shortLabel: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
  align?: "left" | "right";
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const panelId = useId();

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
        aria-controls={panelId}
        title={label}
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "inline-flex cursor-pointer items-center gap-1.5 rounded-xl border px-2.5 py-1.5 text-xs font-medium shadow-sm transition",
          open
            ? "border-indigo-300 bg-indigo-50 text-indigo-800"
            : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50"
        )}
      >
        {icon ? (
          <span className="flex shrink-0 text-slate-500" aria-hidden>
            {icon}
          </span>
        ) : null}
        <span>{shortLabel}</span>
      </button>

      {open ? (
        <div
          id={panelId}
          role="dialog"
          aria-label={title}
          className={cn(
            "absolute top-full z-50 mt-2 max-h-[min(70vh,28rem)] w-[min(100vw-2rem,24rem)] overflow-y-auto rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-600 shadow-lg overscroll-contain",
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

function LegendIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
      <rect x="1" y="1" width="5" height="5" rx="1" fill="#eff6ff" stroke="#94a3b8" />
      <rect x="8" y="1" width="5" height="5" rx="1" fill="#fffde7" stroke="#94a3b8" />
      <rect x="1" y="8" width="5" height="5" rx="1" fill="#ffebee" stroke="#94a3b8" />
      <rect x="8" y="8" width="5" height="5" rx="1" fill="#e8f5e9" stroke="#94a3b8" />
    </svg>
  );
}

function GuideIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
      <circle cx="7" cy="7" r="6" stroke="currentColor" strokeWidth="1.2" />
      <path
        d="M7 6.2V4.5M7 9.2h.01"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
    </svg>
  );
}

export { LegendIcon, GuideIcon };
