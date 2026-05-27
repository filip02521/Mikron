/** Wspólne elementy SVG tarczy w AppBrandMark (viewBox 32×32). */

import {
  BRAND_CLOCK_GRADIENT_COORDS,
  BRAND_CLOCK_HAND_GRADIENT,
  BRAND_CLOCK_HANDS_LAYER_OPACITY,
  BRAND_CLOCK_HOUR_STROKE,
  BRAND_CLOCK_MINUTE_STROKE,
  BRAND_CLOCK_TICK_FILL,
} from "@/lib/ui/brand-clock-colors";

export const BRAND_CLOCK_TICK_RADIUS = 12.85;
export const BRAND_CLOCK_TICK_MARKS = [0, 90, 180, 270] as const;

export function brandClockGradientId(instanceId: string): string {
  return `ontime-hand-gradient-${instanceId.replace(/[^a-zA-Z0-9_-]/g, "")}`;
}

export function BrandClockGradientDef({ id }: { id: string }) {
  const { from, fromOpacity, to, toOpacity } = BRAND_CLOCK_HAND_GRADIENT;
  const { x1, y1, x2, y2 } = BRAND_CLOCK_GRADIENT_COORDS;

  return (
    <linearGradient
      id={id}
      gradientUnits="userSpaceOnUse"
      x1={x1}
      y1={y1}
      x2={x2}
      y2={y2}
    >
      <stop offset="0%" stopColor={from} stopOpacity={fromOpacity} />
      <stop offset="100%" stopColor={to} stopOpacity={toOpacity} />
    </linearGradient>
  );
}

export function BrandClockTicks({ show }: { show: boolean }) {
  if (!show) return null;

  return (
    <>
      {BRAND_CLOCK_TICK_MARKS.map((angle) => (
        <circle
          key={angle}
          cx="0"
          cy={-BRAND_CLOCK_TICK_RADIUS}
          r="0.42"
          fill={BRAND_CLOCK_TICK_FILL}
          transform={`rotate(${angle})`}
        />
      ))}
    </>
  );
}
