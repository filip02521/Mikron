import { cn } from "@/lib/cn";
import { BRAND_MARK_COLOR } from "@/lib/ui/brand-app-icon-svg";

/**
 * Węzeł kroku z logo OnTime. W toku: przygaszona tarcza i sam obiegający łuk (bez ptaszka).
 * Zakończony: tarcza się domyka, wskazówki wracają, ptaszek się rysuje — powstaje pełne logo.
 * To jeden SVG, więc zmiana stanu animuje się przejściami (CSS `.brand-step`); wejście od razu
 * w stanie „done” pokazuje gotowe logo bez animacji.
 */
export function BrandStepMark({
  state,
  size = 32,
  className,
}: {
  state: "running" | "done";
  size?: number;
  className?: string;
}) {
  return (
    <span className={cn("brand-step inline-flex shrink-0", className)} data-state={state} aria-hidden>
      <svg viewBox="0 0 64 64" width={size} height={size} focusable="false">
        <rect width="64" height="64" rx="15" fill={BRAND_MARK_COLOR} />
        <circle className="brand-step__ring" cx="32" cy="32" r="21" fill="none" stroke="#fff" strokeWidth="3.6" />
        <circle
          className="brand-step__arc"
          cx="32"
          cy="32"
          r="21"
          fill="none"
          stroke="#fff"
          strokeWidth="3.6"
          strokeLinecap="round"
          pathLength={1}
        />
        <g className="brand-step__ticks" stroke="#fff" strokeOpacity=".5" strokeWidth="2.2" strokeLinecap="round">
          <line x1="32" y1="17.8" x2="32" y2="15.6" />
          <line x1="46.2" y1="32" x2="48.4" y2="32" />
          <line x1="32" y1="46.2" x2="32" y2="48.4" />
          <line x1="17.8" y1="32" x2="15.6" y2="32" />
        </g>
        <path
          className="brand-step__check"
          d="M22.6 30.4 L29.6 37.4 L43.6 21.4"
          fill="none"
          stroke="#fff"
          strokeWidth="5"
          strokeLinecap="round"
          strokeLinejoin="round"
          pathLength={1}
        />
        <circle className="brand-step__dot" cx="29.6" cy="37.4" r="1.5" fill={BRAND_MARK_COLOR} />
      </svg>
    </span>
  );
}
