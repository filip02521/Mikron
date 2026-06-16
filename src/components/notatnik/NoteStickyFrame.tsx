"use client";

import type { CSSProperties, ReactNode } from "react";
import { cn } from "@/lib/cn";
import { noteStickyTiltDeg } from "./note-styles";

export function StickyPushpin({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "pointer-events-none absolute left-1/2 top-0 z-20 -translate-x-1/2 -translate-y-[35%]",
        className
      )}
      aria-hidden
    >
      <span className="relative block h-3 w-3">
        <span className="absolute inset-0 rounded-full bg-gradient-to-br from-indigo-500 to-indigo-700 shadow-sm shadow-indigo-900/25 ring-1 ring-indigo-300/50" />
        <span className="absolute left-1/2 top-[68%] h-1.5 w-px -translate-x-1/2 bg-slate-400/60" />
      </span>
    </span>
  );
}

export function NoteStickyFrame({
  seed,
  straight,
  showPin,
  className,
  children,
}: {
  seed: string;
  straight?: boolean;
  showPin?: boolean;
  className?: string;
  children: ReactNode;
}) {
  const tilt = noteStickyTiltDeg(seed);

  return (
    <div
      className={cn(
        "group/sticky relative isolate pt-2 transition-[transform,z-index] duration-200 ease-out will-change-transform",
        straight
          ? "z-30 [transform:rotate(0deg)_scale(1.01)]"
          : cn(
              "z-0 [transform:rotate(var(--note-tilt))_scale(1)]",
              "hover:z-20 hover:[transform:rotate(0deg)_scale(1.025)]",
              "focus-within:z-30 focus-within:[transform:rotate(0deg)_scale(1.02)]"
            ),
        className
      )}
      style={{ "--note-tilt": `${tilt}deg` } as CSSProperties}
    >
      {showPin ? <StickyPushpin /> : null}
      {children}
    </div>
  );
}
