import { cn } from "@/lib/cn";
import { BRAND_MARK_COLOR } from "@/lib/ui/brand-app-icon-svg";

const SIZE_PX = { sm: 20, md: 32, lg: 48, xl: 72 } as const;

/**
 * Loader z logo OnTime: przygaszona tarcza, jasny łuk obiega ją w kółko, ptaszek stoi.
 * Pojawia się po 250 ms (krótkie ładowanie nie mignie). CSS (działa przy zajętym wątku);
 * „ogranicz ruch” → spokojne pulsowanie zamiast obiegu. Do przycisków zostaje `Spinner`.
 */
export function BrandLoader({
  size = "md",
  tile = true,
  label,
  className,
}: {
  size?: keyof typeof SIZE_PX;
  /** Kafel petrol (jak logo) albo sam rysunek w kolorze marki — małe użycia przy tekście. */
  tile?: boolean;
  /** Tekst dla czytników; bez niego znak jest dekoracją obok widocznego opisu. */
  label?: string;
  className?: string;
}) {
  const px = SIZE_PX[size];
  // Bez kafla znak stoi na karcie: kolor z motywu (w jasnym = BRAND_MARK_COLOR).
  const ink = tile ? "#fff" : "var(--color-primary)";
  const bg = tile ? BRAND_MARK_COLOR : "#fff";
  return (
    <span
      className={cn("brand-loader inline-flex shrink-0", className)}
      style={{ width: px, height: px }}
      {...(label ? { role: "img", "aria-label": label } : { "aria-hidden": true })}
    >
      <svg viewBox="0 0 64 64" width={px} height={px} focusable="false">
        {tile ? <rect width="64" height="64" rx="15" fill={bg} /> : null}
        <circle className="brand-loader__ring" cx="32" cy="32" r="21" fill="none" stroke={ink} strokeWidth="3.6" />
        <circle
          className="brand-loader__arc"
          cx="32"
          cy="32"
          r="21"
          fill="none"
          stroke={ink}
          strokeWidth="3.6"
          strokeLinecap="round"
          pathLength={1}
        />
        <g stroke={ink} strokeOpacity=".5" strokeWidth="2.2" strokeLinecap="round">
          <line x1="32" y1="17.8" x2="32" y2="15.6" />
          <line x1="46.2" y1="32" x2="48.4" y2="32" />
          <line x1="32" y1="46.2" x2="32" y2="48.4" />
          <line x1="17.8" y1="32" x2="15.6" y2="32" />
        </g>
        <path
          d="M22.6 30.4 L29.6 37.4 L43.6 21.4"
          fill="none"
          stroke={ink}
          strokeWidth="5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle cx="29.6" cy="37.4" r="1.5" fill={bg} />
      </svg>
    </span>
  );
}
