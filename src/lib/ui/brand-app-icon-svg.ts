import {
  BRAND_CLOCK_GRADIENT_COORDS,
  BRAND_CLOCK_HAND_GRADIENT,
  BRAND_CLOCK_TICK_FILL,
} from "@/lib/ui/brand-clock-colors";
import {
  BRAND_CLOCK_HOUR_OUTER_RADIUS,
  BRAND_CLOCK_INNER_RADIUS,
  BRAND_CLOCK_INTRO_ANGLES,
  BRAND_CLOCK_MINUTE_OUTER_RADIUS,
} from "@/lib/ui/brand-clock-geometry";
import { BRAND_CLOCK_TICK_MARKS, BRAND_CLOCK_TICK_RADIUS } from "@/lib/ui/brand-clock-svg";
import { ONTIME_LOGO_MONOGRAM } from "@/lib/ui/ontime-brand";

/** Statyczna ikona aplikacji — ten sam układ co AppBrandMark (gradient, tarcza, OT). */
export function buildBrandAppIconSvg(): string {
  const { from, fromOpacity, to, toOpacity } = BRAND_CLOCK_HAND_GRADIENT;
  const { x1, y1, x2, y2 } = BRAND_CLOCK_GRADIENT_COORDS;
  const ticks = BRAND_CLOCK_TICK_MARKS.map(
    (angle) =>
      `<circle cx="0" cy="${-BRAND_CLOCK_TICK_RADIUS}" r="0.42" fill="${BRAND_CLOCK_TICK_FILL}" transform="rotate(${angle})"/>`
  ).join("");

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" role="img" aria-label="OnTime">
  <defs>
    <linearGradient id="ontime-bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#4f46e5"/>
      <stop offset="100%" stop-color="#0284c7"/>
    </linearGradient>
    <linearGradient id="ontime-hand" gradientUnits="userSpaceOnUse" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}">
      <stop offset="0%" stop-color="${from}" stop-opacity="${fromOpacity}"/>
      <stop offset="100%" stop-color="${to}" stop-opacity="${toOpacity}"/>
    </linearGradient>
  </defs>
  <circle cx="16" cy="16" r="16" fill="url(#ontime-bg)"/>
  <g transform="translate(16 16)" stroke-linecap="round" opacity="0.68">
    ${ticks}
    <g transform="rotate(${BRAND_CLOCK_INTRO_ANGLES.minute})">
      <line x1="0" y1="${-BRAND_CLOCK_INNER_RADIUS}" x2="0" y2="${-BRAND_CLOCK_MINUTE_OUTER_RADIUS}" stroke="url(#ontime-hand)" stroke-width="1.7"/>
    </g>
    <g transform="rotate(${BRAND_CLOCK_INTRO_ANGLES.hour})">
      <line x1="0" y1="${-BRAND_CLOCK_INNER_RADIUS}" x2="0" y2="${-BRAND_CLOCK_HOUR_OUTER_RADIUS}" stroke="url(#ontime-hand)" stroke-width="1.55"/>
    </g>
  </g>
  <circle cx="16" cy="16" r="13.5" fill="none" stroke="rgba(255,255,255,0.25)" stroke-width="1"/>
  <text x="16" y="20.5" text-anchor="middle" fill="#ffffff" font-family="ui-sans-serif, system-ui, sans-serif" font-size="10.5" font-weight="700" letter-spacing="-0.04em">${ONTIME_LOGO_MONOGRAM}</text>
</svg>`;
}

export function brandAppIconDataUri(): string {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(buildBrandAppIconSvg())}`;
}
