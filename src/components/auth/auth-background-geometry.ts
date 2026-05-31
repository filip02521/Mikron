/** Współrzędne SVG tła auth — deterministyczne na SSR i kliencie. */

const TICK_COUNT = 12;

/** Stała precyzja — identyczny HTML na SSR i kliencie (unika hydration mismatch). */
export function roundSvgCoord(n: number): string {
  return (Math.round(n * 100) / 100).toFixed(2);
}

export function authTickLines(
  cx: number,
  cy: number,
  radius: number,
  innerRatio: number,
  majorEvery = 3
): Array<{ x1: string; y1: string; x2: string; y2: string; major: boolean }> {
  const lines: Array<{ x1: string; y1: string; x2: string; y2: string; major: boolean }> = [];
  for (let i = 0; i < TICK_COUNT; i++) {
    const angle = (i * 360) / TICK_COUNT - 90;
    const rad = (angle * Math.PI) / 180;
    const major = i % majorEvery === 0;
    const outer = radius;
    const inner = radius * (major ? innerRatio : innerRatio + 0.04);
    lines.push({
      x1: roundSvgCoord(cx + Math.cos(rad) * inner),
      y1: roundSvgCoord(cy + Math.sin(rad) * inner),
      x2: roundSvgCoord(cx + Math.cos(rad) * outer),
      y2: roundSvgCoord(cy + Math.sin(rad) * outer),
      major,
    });
  }
  return lines;
}
