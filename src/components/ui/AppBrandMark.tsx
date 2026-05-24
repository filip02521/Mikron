import { cn } from "@/lib/cn";
import { brandMarkOnDarkClass, brandMarkOnLightClass } from "@/lib/ui/brand";
import { ONTIME_LOGO_MONOGRAM, ONTIME_LOGO_SHAPE } from "@/lib/ui/ontime-brand";

const SIZE_STYLES = {
  sm: {
    box: "h-8 w-8",
    text: "text-[0.65rem] tracking-tighter",
  },
  md: {
    box: "h-10 w-10",
    text: "text-[0.7rem] tracking-tighter",
  },
  lg: {
    box: "h-14 w-14",
    text: "text-lg tracking-tight",
  },
} as const;

export function AppBrandMark({
  className,
  size = "md",
  variant = "light",
}: {
  className?: string;
  size?: keyof typeof SIZE_STYLES;
  /** light = sidebar/aplikacja, dark = panel boczny logowania */
  variant?: "light" | "dark";
}) {
  const { box, text } = SIZE_STYLES[size];
  const toneClass = variant === "dark" ? brandMarkOnDarkClass : brandMarkOnLightClass;

  return (
    <span
      className={cn(
        "relative flex shrink-0 items-center justify-center font-bold",
        ONTIME_LOGO_SHAPE,
        box,
        text,
        toneClass,
        className
      )}
      aria-hidden
    >
      <span
        className="pointer-events-none absolute inset-[3px] rounded-[inherit] border border-white/25"
        aria-hidden
      />
      {ONTIME_LOGO_MONOGRAM}
    </span>
  );
}
