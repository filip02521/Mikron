import { cn } from "@/lib/cn";
import { BRAND_MARK_COLOR, brandMarkGlyphSvg } from "@/lib/ui/brand-app-icon-svg";
import { ONTIME_LOGO_SHAPE } from "@/lib/ui/ontime-brand";

const SIZE_STYLES = {
  sm: "h-8 w-8",
  md: "h-10 w-10",
  lg: "h-14 w-14",
} as const;

/** Statyczny rysunek — bezpieczny do wstawienia jako SVG. */
const GLYPH_LIGHT = brandMarkGlyphSvg();
const GLYPH_DARK = brandMarkGlyphSvg("transparent");

/** Znak OnTime: wskazówki zegara układające się w ptaszek, na kaflu petrol. */
export function AppBrandMark({
  className,
  size = "md",
  variant = "light",
}: {
  className?: string;
  size?: keyof typeof SIZE_STYLES;
  /** light = sidebar/aplikacja, dark = półprzezroczysty kafel na ciemnym tle */
  variant?: "light" | "dark";
}) {
  const dark = variant === "dark";
  return (
    <span
      className={cn(
        "relative flex shrink-0 overflow-hidden shadow-[var(--shadow-brand)]",
        ONTIME_LOGO_SHAPE,
        SIZE_STYLES[size],
        className
      )}
      aria-hidden
    >
      <svg viewBox="0 0 64 64" className="h-full w-full" focusable="false">
        <rect width="64" height="64" fill={dark ? "rgba(255,255,255,0.15)" : BRAND_MARK_COLOR} />
        <g dangerouslySetInnerHTML={{ __html: dark ? GLYPH_DARK : GLYPH_LIGHT }} />
      </svg>
    </span>
  );
}
