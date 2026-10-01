"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { IconHelpCircle } from "@/components/icons/StrokeIcons";
import { useClientHydrated } from "@/lib/client/use-client-hydrated";
import { cn } from "@/lib/cn";

export type HelpHintTone =
  | "warning"
  | "sky"
  | "indigo"
  | "emerald"
  | "violet"
  | "slate";

const toneButtonClass: Record<HelpHintTone, string> = {
  warning: "text-amber-700 hover:bg-amber-100/80 focus-visible:ring-amber-300",
  sky: "text-sky-700 hover:bg-sky-100/80 focus-visible:ring-sky-300",
  indigo: "text-indigo-700 hover:bg-indigo-100/80 focus-visible:ring-indigo-300",
  emerald: "text-emerald-700 hover:bg-emerald-100/80 focus-visible:ring-emerald-300",
  violet: "text-violet-700 hover:bg-violet-100/80 focus-visible:ring-violet-300",
  slate: "text-slate-600 hover:bg-slate-200/80 focus-visible:ring-slate-300",
};

const tonePanelClass: Record<HelpHintTone, string> = {
  warning: "border-amber-200/90 bg-amber-50 text-amber-950",
  sky: "border-sky-200/90 bg-sky-50 text-sky-950",
  indigo: "border-indigo-200/90 bg-indigo-50 text-indigo-950",
  emerald: "border-emerald-200/90 bg-emerald-50 text-emerald-950",
  violet: "border-violet-200/90 bg-violet-50 text-violet-950",
  slate: "border-slate-200/90 bg-slate-50 text-slate-800",
};

const TOOLTIP_MAX_WIDTH = 280;
const TOOLTIP_GAP = 6;

/** Ikona ? z dymkiem — hover, focus lub klik (portal, bez ucinania overflow). */
export function HelpHintBubble({
  message,
  tone = "slate",
  className,
  size = "sm",
  ariaLabel = "Wyjaśnienie",
}: {
  message: string;
  tone?: HelpHintTone;
  className?: string;
  size?: "sm" | "md";
  ariaLabel?: string;
}) {
  const tooltipId = useId();
  const mounted = useClientHydrated();
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [hovered, setHovered] = useState(false);
  const [pinned, setPinned] = useState(false);
  const open = hovered || pinned;
  const [panelPos, setPanelPos] = useState<{
    top: number;
    left: number;
    transform?: string;
  } | null>(null);

  const updatePosition = useCallback(() => {
    const trigger = buttonRef.current;
    if (!trigger) return;
    const rect = trigger.getBoundingClientRect();
    const width = Math.min(TOOLTIP_MAX_WIDTH, window.innerWidth - 16);
    const left = Math.min(Math.max(8, rect.left), window.innerWidth - width - 8);
    const belowTop = rect.bottom + TOOLTIP_GAP;
    const aboveTop = rect.top - TOOLTIP_GAP;
    const preferBelow = belowTop + 88 < window.innerHeight;
    setPanelPos({
      top: preferBelow ? belowTop : aboveTop,
      left,
      transform: preferBelow ? undefined : "translateY(-100%)",
    });
  }, []);

  useEffect(() => {
    if (!open) return;
    updatePosition();
    const onScrollOrResize = () => updatePosition();
    window.addEventListener("scroll", onScrollOrResize, true);
    window.addEventListener("resize", onScrollOrResize);
    return () => {
      window.removeEventListener("scroll", onScrollOrResize, true);
      window.removeEventListener("resize", onScrollOrResize);
    };
  }, [open, updatePosition]);

  useEffect(() => {
    if (!pinned) return;
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (buttonRef.current?.contains(target)) return;
      setPinned(false);
      setHovered(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [pinned]);

  const showTooltip = open && panelPos != null && mounted;
  const iconSize = size === "md" ? 15 : 14;
  const buttonSize = size === "md" ? "size-6" : "size-5";

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        aria-label={ariaLabel}
        aria-expanded={open}
        aria-describedby={showTooltip ? tooltipId : undefined}
        onPointerDown={(event) => event.stopPropagation()}
        onClick={(event) => {
          event.stopPropagation();
          event.preventDefault();
          setPinned((value) => {
            const next = !value;
            if (next) updatePosition();
            return next;
          });
        }}
        onMouseEnter={() => {
          updatePosition();
          setHovered(true);
        }}
        onMouseLeave={() => setHovered(false)}
        onFocus={() => {
          updatePosition();
          setHovered(true);
        }}
        onBlur={() => setHovered(false)}
        className={cn(
          "inline-flex shrink-0 items-center justify-center rounded-full transition-colors",
          buttonSize,
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1",
          toneButtonClass[tone],
          className
        )}
      >
        <IconHelpCircle size={iconSize} className="shrink-0" aria-hidden />
      </button>
      {showTooltip
        ? createPortal(
            <span
              id={tooltipId}
              role="tooltip"
              style={{
                position: "fixed",
                top: panelPos.top,
                left: panelPos.left,
                width: TOOLTIP_MAX_WIDTH,
                zIndex: 80,
                transform: panelPos.transform,
              }}
              className={cn(
                "pointer-events-none rounded-md border px-2.5 py-2 text-xs leading-relaxed shadow-md",
                tonePanelClass[tone]
              )}
            >
              {message}
            </span>,
            document.body
          )
        : null}
    </>
  );
}
