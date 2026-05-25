"use client";

import { useCallback, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import { buttonGroupItemClass } from "@/lib/ui/surfaces";

const DEFAULT_HOLD_MS = 650;

type Variant = "primary" | "outline" | "sky";

const variantShell: Record<Variant, string> = {
  primary:
    "bg-indigo-600 text-white hover:bg-indigo-700 active:bg-indigo-800",
  outline:
    "border border-indigo-200 bg-indigo-50/50 text-indigo-700 hover:bg-indigo-50",
  sky: "bg-sky-600 text-white hover:bg-sky-700 active:bg-sky-800",
};

const variantFill: Record<Variant, string> = {
  primary: "bg-indigo-300/50",
  outline: "bg-indigo-200/70",
  sky: "bg-sky-300/50",
};

const variantRing: Record<Variant, string> = {
  primary: "ring-indigo-400/40",
  outline: "ring-indigo-400/40",
  sky: "ring-sky-400/40",
};

export function HoldToConfirmButton({
  label,
  variant = "primary",
  disabled = false,
  holdMs = DEFAULT_HOLD_MS,
  className,
  onConfirm,
}: {
  label: string;
  variant?: Variant;
  disabled?: boolean;
  holdMs?: number;
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
        "relative inline-flex min-w-[5.5rem] cursor-pointer select-none items-center justify-center overflow-hidden px-3 py-2 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50",
        buttonGroupItemClass,
        variantShell[variant],
        holding && cn("ring-2 ring-offset-1", variantRing[variant]),
        className
      )}
    >
      <span
        aria-hidden
        className={cn(
          "pointer-events-none absolute inset-y-0 left-0 origin-left transition-none motion-reduce:hidden",
          variantFill[variant]
        )}
        style={{ width: `${progress * 100}%` }}
      />
      <span className="relative z-10 tabular-nums">
        {holding && progress > 0.15 && progress < 1 ? "Przytrzymaj…" : label}
      </span>
    </button>
  );
}
