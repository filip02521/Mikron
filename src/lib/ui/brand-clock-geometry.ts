/** Geometria wskazówek w AppBrandMark (viewBox 32×32). */
export const BRAND_CLOCK_INNER_RADIUS = 7.25;
export const BRAND_CLOCK_HOUR_OUTER_RADIUS = 8.75;
export const BRAND_CLOCK_MINUTE_OUTER_RADIUS = 10.25;

/** Pozycja startowa animacji — 10:30. */
export const BRAND_CLOCK_INTRO_ANGLES = {
  hour: 315,
  minute: 180,
} as const;

export type BrandClockAngles = {
  hour: number;
  minute: number;
};

/** Kąty zgodne z SVG: 0° = XII, dodatnie = zgodnie z ruchem wskazówek. */
export function brandClockAnglesFromDate(date = new Date()): BrandClockAngles {
  const hours = date.getHours();
  const minutes = date.getMinutes();
  const seconds = date.getSeconds();

  return {
    hour: (hours % 12) * 30 + minutes * 0.5 + seconds * (30 / 3600),
    minute: minutes * 6 + seconds * 0.1,
  };
}
