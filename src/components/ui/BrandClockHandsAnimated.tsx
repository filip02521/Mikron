"use client";

import { useEffect, useId, useState } from "react";
import { cn } from "@/lib/cn";
import {
  BRAND_CLOCK_HOUR_OUTER_RADIUS,
  BRAND_CLOCK_INNER_RADIUS,
  BRAND_CLOCK_INTRO_ANGLES,
  BRAND_CLOCK_MINUTE_OUTER_RADIUS,
  brandClockAnglesFromDate,
  type BrandClockAngles,
} from "@/lib/ui/brand-clock-geometry";
import {
  BrandClockGradientDef,
  BrandClockTicks,
  brandClockGradientId,
} from "@/lib/ui/brand-clock-svg";
import {
  BRAND_CLOCK_HANDS_LAYER_OPACITY,
  BRAND_CLOCK_HOUR_STROKE,
  BRAND_CLOCK_MINUTE_STROKE,
} from "@/lib/ui/brand-clock-colors";

const INTRO_ANIMATION_MS = 900;

function easeOutCubic(t: number): number {
  return 1 - (1 - t) ** 3;
}

function lerpAngle(from: number, to: number, t: number): number {
  let delta = to - from;
  while (delta > 180) delta -= 360;
  while (delta < -180) delta += 360;
  return from + delta * t;
}

function lerpAngles(from: BrandClockAngles, to: BrandClockAngles, t: number): BrandClockAngles {
  return {
    hour: lerpAngle(from.hour, to.hour, t),
    minute: lerpAngle(from.minute, to.minute, t),
  };
}

function ClockHand({
  innerRadius,
  outerRadius,
  angle,
  strokeWidth,
  stroke,
}: {
  innerRadius: number;
  outerRadius: number;
  angle: number;
  strokeWidth: number;
  stroke: string;
}) {
  return (
    <g transform={`rotate(${angle})`}>
      <line
        x1="0"
        y1={-innerRadius}
        x2="0"
        y2={-outerRadius}
        stroke={stroke}
        strokeWidth={strokeWidth}
      />
    </g>
  );
}

export function BrandClockHandsAnimated({
  className,
  showTicks = false,
}: {
  className?: string;
  showTicks?: boolean;
}) {
  const gradientId = brandClockGradientId(useId());
  const handStroke = `url(#${gradientId})`;
  const [angles, setAngles] = useState<BrandClockAngles>(() => {
    if (
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      return brandClockAnglesFromDate();
    }
    return BRAND_CLOCK_INTRO_ANGLES;
  });

  useEffect(() => {
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (reducedMotion) return;

    const introStart = performance.now();
    const introTarget = brandClockAnglesFromDate();
    let frame = 0;
    let interval = 0;

    const syncLive = () => setAngles(brandClockAnglesFromDate());

    const runIntro = (now: number) => {
      const progress = Math.min(1, (now - introStart) / INTRO_ANIMATION_MS);

      if (progress < 1) {
        setAngles(
          lerpAngles(BRAND_CLOCK_INTRO_ANGLES, introTarget, easeOutCubic(progress))
        );
        frame = requestAnimationFrame(runIntro);
        return;
      }

      syncLive();
      interval = window.setInterval(syncLive, 1000);
    };

    frame = requestAnimationFrame(() => {
      frame = requestAnimationFrame(runIntro);
    });

    return () => {
      cancelAnimationFrame(frame);
      window.clearInterval(interval);
    };
  }, []);

  return (
    <svg
      viewBox="0 0 32 32"
      className={cn("pointer-events-none absolute inset-0 z-0 size-full", className)}
      aria-hidden
    >
      <defs>
        <BrandClockGradientDef id={gradientId} />
      </defs>
      <g
        transform="translate(16 16)"
        strokeLinecap="round"
        opacity={BRAND_CLOCK_HANDS_LAYER_OPACITY}
      >
        <BrandClockTicks show={showTicks} />
        <ClockHand
          innerRadius={BRAND_CLOCK_INNER_RADIUS}
          outerRadius={BRAND_CLOCK_MINUTE_OUTER_RADIUS}
          angle={angles.minute}
          strokeWidth={BRAND_CLOCK_MINUTE_STROKE}
          stroke={handStroke}
        />
        <ClockHand
          innerRadius={BRAND_CLOCK_INNER_RADIUS}
          outerRadius={BRAND_CLOCK_HOUR_OUTER_RADIUS}
          angle={angles.hour}
          strokeWidth={BRAND_CLOCK_HOUR_STROKE}
          stroke={handStroke}
        />
      </g>
    </svg>
  );
}
