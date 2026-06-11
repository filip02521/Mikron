"use client";

import {
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { IconColorLegendSample, IconHelpCircle } from "@/components/icons/StrokeIcons";
import { useClientHydrated } from "@/lib/client/use-client-hydrated";
import { cn } from "@/lib/cn";

type PanelPosition = { top: number; left: number };

const PANEL_WIDTH = 384; // w-[24rem]
const PANEL_GAP = 8;
const PANEL_MAX_HEIGHT = 448; // max-h-[28rem]

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
  icon?: ReactNode;
  children: ReactNode;
  align?: "left" | "right";
  className?: string;
  buttonClassName?: string;
}) {
  const [open, setOpen] = useState(false);
  const mounted = useClientHydrated();
  const [panelPos, setPanelPos] = useState<PanelPosition | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const generatedId = useId();
  const panelId = mounted ? generatedId : undefined;

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.stopPropagation();
      e.preventDefault();
      setOpen(false);
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [open]);

  const updatePosition = () => {
    const trigger = triggerRef.current;
    if (!trigger) return;
    const rect = trigger.getBoundingClientRect();
    const panelWidth = panelRef.current?.offsetWidth ?? PANEL_WIDTH;
    const panelHeight = Math.min(
      panelRef.current?.offsetHeight ?? PANEL_MAX_HEIGHT,
      window.innerHeight - PANEL_GAP * 2
    );
    const maxLeft = window.innerWidth - panelWidth - PANEL_GAP;
    const left =
      align === "right"
        ? Math.min(Math.max(PANEL_GAP, rect.right - panelWidth), maxLeft)
        : Math.min(Math.max(PANEL_GAP, rect.left), maxLeft);

    const belowTop = rect.bottom + PANEL_GAP;
    const aboveTop = rect.top - panelHeight - PANEL_GAP;
    const fitsBelow = belowTop + panelHeight <= window.innerHeight - PANEL_GAP;
    const fitsAbove = aboveTop >= PANEL_GAP;
    let top = belowTop;
    if (!fitsBelow && fitsAbove) {
      top = aboveTop;
    } else if (!fitsBelow) {
      top = Math.max(PANEL_GAP, window.innerHeight - panelHeight - PANEL_GAP);
    }

    setPanelPos({ top, left });
  };

  useLayoutEffect(() => {
    if (!open) return;
    updatePosition();
    const raf = requestAnimationFrame(updatePosition);
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [open, align]);

  useEffect(() => {
    if (!open) return;
    const onPointer = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        triggerRef.current?.contains(target) ||
        panelRef.current?.contains(target) ||
        rootRef.current?.contains(target)
      ) {
        return;
      }
      setOpen(false);
    };
    const t = window.setTimeout(() => {
      document.addEventListener("mousedown", onPointer);
    }, 0);
    return () => {
      window.clearTimeout(t);
      document.removeEventListener("mousedown", onPointer);
    };
  }, [open]);

  const panel =
    open && panelId && panelPos && mounted ? (
      <div
        id={panelId}
        ref={panelRef}
        role="dialog"
        aria-label={title}
        style={{ top: panelPos.top, left: panelPos.left }}
        className="fixed z-[72] max-h-[min(70vh,28rem)] w-[min(100vw-2rem,24rem)] overflow-y-auto overscroll-contain rounded-md border border-slate-200 bg-white p-4 text-sm text-slate-600 shadow-lg"
      >
        <p className="mb-3 text-sm font-semibold text-slate-900">{title}</p>
        {children}
      </div>
    ) : null;

  return (
    <div ref={rootRef} className={cn("relative inline-flex", className)}>
      <button
        ref={triggerRef}
        type="button"
        aria-label={label}
        aria-expanded={open}
        aria-haspopup="dialog"
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
        {shortLabel.trim() ? <span>{shortLabel}</span> : null}
      </button>

      {panel && typeof document !== "undefined" ? createPortal(panel, document.body) : null}
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
