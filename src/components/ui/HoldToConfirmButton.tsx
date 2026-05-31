"use client";

import { useCallback, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import { IconHoldPress } from "@/components/icons/StrokeIcons";
import {
  panelHoldOutlineSegmentClass,
  panelSegmentPrimaryClass,
} from "@/lib/ui/ontime-theme";
import { buttonGroupItemClass } from "@/lib/ui/surfaces";

const DEFAULT_HOLD_MS = 650;
export const HOLD_CONFIRM_SECONDS = DEFAULT_HOLD_MS / 1000;

type Variant = "primary" | "outline" | "sky";
type SegmentPosition = "first" | "middle" | "last";

const segmentRound: Record<SegmentPosition, string> = {
  first: "rounded-none rounded-l-md",
  middle: "rounded-none",
  last: "rounded-none rounded-r-md",
};

const variantShell: Record<Variant, string> = {
  primary: panelSegmentPrimaryClass,
  outline: cn(
    "flex h-7 min-h-7 max-h-7 items-center justify-center px-2.5",
    panelHoldOutlineSegmentClass
  ),
  sky: cn(
    panelSegmentPrimaryClass,
    "bg-gradient-to-b from-sky-600 to-sky-700 shadow-sm shadow-sky-600/15 hover:from-sky-600 hover:to-sky-800"
  ),
};

const variantFill: Record<Variant, string> = {
  primary: "bg-white/25",
  outline: "bg-indigo-200/60",
  sky: "bg-white/25",
};

const variantRing: Record<Variant, string> = {
  primary: "ring-white/40",
  outline: "ring-indigo-400/45",
  sky: "ring-white/40",
};

export function HoldToConfirmButton({
  label,
  variant = "primary",
  disabled = false,
  holdMs = DEFAULT_HOLD_MS,
  segmentPosition = "middle",
  showHoldHint = true,
  className,
  onConfirm,
}: {
  label: string;
  variant?: Variant;
  disabled?: boolean;
  holdMs?: number;
  /** Zaokrąglenie w grupie segmentów. */
  segmentPosition?: SegmentPosition;
  /** Ikona i pasek podpowiedzi — prośby indywidualne. */
  showHoldHint?: boolean;
  className?: string;
  onConfirm: () => void;
}) {
  const [progress, setProgress] = useState(0);
  const [holding, setHolding] = useState(false);
  const startAtRef = useRef<number | null>(null);
  const rafRef = useRef<number | null>(null);
  const firedRef = useRef(false);

  const stop = useCallback(() => {
    startAtRef.current = null;
    firedRef.current = false;
    setHolding(false);
    if (rafRef.current != null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    setProgress(0);
  }, []);

  const tick = useCallback(
    (now: number) => {
      const start = startAtRef.current;
      if (start == null || firedRef.current) return;

      const p = Math.min(1, (now - start) / holdMs);
      setProgress(p);

      if (p >= 1) {
        firedRef.current = true;
        setHolding(false);
        setProgress(1);
        if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
        onConfirm();
        window.setTimeout(stop, 180);
        return;
      }

      rafRef.current = requestAnimationFrame(tick);
    },
    [holdMs, onConfirm, stop]
  );

  const start = useCallback(() => {
    if (disabled || firedRef.current) return;
    setHolding(true);
    startAtRef.current = performance.now();
    rafRef.current = requestAnimationFrame(tick);
  }, [disabled, tick]);

  return (
    <button
      type="button"
      disabled={disabled}
      aria-label={`${label}. Przytrzymaj ok. ${Math.round(holdMs / 100) / 10} s, aby potwierdzić.`}
      title="Przytrzymaj, aby potwierdzić"
      onPointerDown={(e) => {
        if (disabled || e.button !== 0) return;
        e.currentTarget.setPointerCapture(e.pointerId);
        start();
      }}
      onPointerUp={(e) => {
        if (e.currentTarget.hasPointerCapture(e.pointerId)) {
          e.currentTarget.releasePointerCapture(e.pointerId);
        }
        stop();
      }}
      onPointerLeave={stop}
      onPointerCancel={stop}
      onContextMenu={(e) => e.preventDefault()}
      className={cn(
        "relative shrink-0 cursor-pointer select-none overflow-hidden text-xs font-semibold leading-none transition-[colors,box-shadow] duration-150 disabled:cursor-not-allowed disabled:opacity-50",
        buttonGroupItemClass,
        variantShell[variant],
        segmentRound[segmentPosition],
        holding && cn("ring-2 ring-inset transition-shadow duration-150", variantRing[variant]),
        className
      )}
    >
      <span
        aria-hidden
        className={cn(
          "pointer-events-none absolute inset-y-0 left-0 origin-left motion-reduce:hidden",
          variantFill[variant]
        )}
        style={{ width: `${progress * 100}%` }}
      />
      {showHoldHint && progress === 0 ? (
        <span
          aria-hidden
          className={cn(
            "pointer-events-none absolute inset-x-0 bottom-0 h-0.5 motion-reduce:hidden",
            variant === "outline" ? "bg-indigo-400/35" : "bg-white/30"
          )}
        />
      ) : null}
      <span className="relative z-10 inline-flex items-center gap-1 whitespace-nowrap tabular-nums">
        {showHoldHint && !holding ? (
          <IconHoldPress
            size={11}
            strokeWidth={2.25}
            className={cn(
              "motion-reduce:hidden",
              variant === "outline" ? "text-indigo-500/85" : "text-white/80"
            )}
          />
        ) : null}
        {label}
      </span>
    </button>
  );
}
